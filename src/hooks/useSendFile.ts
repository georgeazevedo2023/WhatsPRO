import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy, uazapiProxyRaw } from '@/lib/uazapiClient';
import { rawRestInsert, rawRestUpdate } from '@/lib/rawSupabaseApi';
import { getStoredAccessToken } from '@/lib/directStorageUpload';
import { toast } from 'sonner';
import { STATUS_IA } from '@/constants/statusIa';
import { detectImageKind, normalizeImageForSend } from '@/lib/normalizeOutboundImage';
import { humanizeSendError } from '@/lib/sendErrors';
import { logSendFailure, logSendSuccess, type SendStage } from '@/lib/sendTelemetry';
import { clearDeadSession, probeSession, recoverStuckSession } from '@/lib/sessionRecovery';
import { decideUploadTimeout } from '@/lib/uploadTimeoutPolicy';
import { directUploadWithRetry } from '@/lib/directStorageUpload';
import type { Tables } from '@/integrations/supabase/types';

interface SendFileOptions {
  conversationId: string;
  inboxId: string;
  instanceId: string;
  contactJid: string;
  userId: string;
}

export interface UseSendFileReturn {
  sendingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  handleSendFile: (file: File, opts: SendFileOptions) => Promise<{ success: boolean; mediaType?: string; mediaUrl?: string; insertedMsg?: Tables<'conversation_messages'>; error?: string }>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (checado APÓS a conversão — HEIC→JPEG reduz)
const MAX_RAW_FILE_SIZE = 50 * 1024 * 1024; // teto duro pré-conversão (protege heic2any de OOM)
// Teto do upload ao Storage: foto de 15MB em 3G leva ~2min — generoso de
// propósito. O que ele mata é o HANG infinito (sessão zumbi), não upload lento.
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Encapsulates file/image upload-and-send logic:
 * uploads to Supabase storage, sends via UAZAPI proxy, persists the message,
 * and broadcasts realtime events.
 */
export function useSendFile(): UseSendFileReturn {
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleSendFile = useCallback(
    async (
      file: File,
      { conversationId, inboxId, instanceId, contactJid, userId }: SendFileOptions,
    ) => {
      const telemetryBase = {
        conversation_id: conversationId,
        instance_id: instanceId,
        user_id: userId || null,
        file_size: file.size,
        file_type: file.type || null,
      };
      if (!instanceId) {
        toast.error('Instância não encontrada');
        return { success: false, error: 'Instância não encontrada.' };
      }
      if (!contactJid) {
        toast.error('Contato sem JID');
        return { success: false, error: 'Contato sem número de WhatsApp.' };
      }
      // Foto "cloud-only" do Google Fotos chega como File de 0 bytes no Android.
      if (file.size === 0) {
        const msg = 'Essa foto parece estar só na nuvem (Google Fotos). Abra a foto no aparelho primeiro e tente de novo.';
        logSendFailure({ ...telemetryBase, stage: 'validate', outcome: 'fail', raw_error: 'empty file (0 bytes)' });
        toast.error(msg);
        return { success: false, error: msg };
      }
      if (file.size > MAX_RAW_FILE_SIZE) {
        const msg = 'O arquivo é grande demais (máximo 50MB). Reduza o tamanho e tente de novo.';
        logSendFailure({ ...telemetryBase, stage: 'validate', outcome: 'fail', raw_error: `raw file too large: ${file.size}` });
        toast.error(msg);
        return { success: false, error: msg };
      }

      setSendingFile(true);
      const startedAt = Date.now();
      // isImage precisa estar visível no catch (mensagem de erro por tipo)
      let isImage = file.type.startsWith('image/');
      // Estágio corrente — vai pra telemetria no catch (diz ONDE falhou).
      let stage: SendStage = 'normalize';
      let detectedKind: string | null = null;
      // Diagnóstico da normalização (downscale/conversão) — vai na telemetria de
      // sucesso E de falha (2026-08-11: hang_timeout no APK sem saber se o
      // downscale tinha rodado — ponto cego fechado).
      let normInfo = '';
      let uploadSize: number | null = null;
      try {
        // Decide imagem vs documento por MAGIC BYTES, não por file.type: no
        // mobile o file.type chega vazio (foto vira "documento" octet-stream).
        const kind = await detectImageKind(file);
        detectedKind = kind;
        isImage = kind !== 'unknown' || file.type.startsWith('image/');
        const mediaType = isImage ? 'image' : 'document';

        // Para imagem: normaliza p/ um formato que o UAZAPI decodifica. HEIC
        // (foto de iPhone / Android HEIF) é convertido p/ JPEG no navegador —
        // o UAZAPI rejeita HEIC com 500 "unsupported image format". JPEG/PNG/
        // WEBP/GIF passam direto. Mandamos a URL pública pro UAZAPI BAIXAR do
        // CDN, então o objeto precisa de content-type/extensão coerentes.
        let uploadFile = file;
        let resolvedContentType: string;
        let ext: string;
        if (isImage) {
          const norm = await normalizeImageForSend(file);
          uploadFile = norm.file;
          resolvedContentType = norm.contentType;
          ext = norm.ext;
          normInfo = norm.downscaled ? 'downscaled' : norm.converted ? 'converted' : 'passthrough';
        } else {
          resolvedContentType = file.type || 'application/octet-stream';
          const extFromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
          const extFromType = resolvedContentType.split('/')[1]?.split(';')[0];
          ext = extFromName || extFromType || 'bin';
        }
        // Cap de 20MB DEPOIS da normalização: a conversão HEIC→JPEG (0.92)
        // reduz o tamanho — checar antes rejeitava foto que caberia.
        if (uploadFile.size > MAX_FILE_SIZE) {
          throw new Error(`file size exceeds maximum: ${uploadFile.size}`);
        }
        uploadSize = uploadFile.size;
        // WebView do APK (2026-08-11, moto g20): File vindo da câmera/galeria é
        // content://-backed e o streaming desse provider pelo fetch pode PENDURAR
        // (hang_timeout com sessão válida). Ler pra memória desacopla o upload do
        // provider. Best-effort "nunca pior": falha de leitura mantém o original.
        // Desde 2026-08-12 o ChatInput já materializa na ENTRADA (leitura
        // one-shot do content:// morria no normalize) — aqui virou cinto de
        // segurança pra chamadores que não materializam; re-read de memória é barato.
        try {
          const buf = await uploadFile.arrayBuffer();
          uploadFile = new File([buf], uploadFile.name || `upload.${ext}`, { type: resolvedContentType });
        } catch { /* mantém o File original */ }

        // Upload por fetch CRU com retry (2026-08-12): o storage-js resolve o
        // token via getSession() ANTES do fetch — client de auth travado (aba/
        // WebView retomada do background) pendurava o upload em 0 bytes por 120s
        // e o recover recarregava a página, matando o File e o retry. O caminho
        // cru lê o token do localStorage, aborta DE VERDADE cada tentativa e
        // re-tenta em conexão nova (socket morto em rede móvel era hang eterno).
        stage = 'upload';
        let fileName: string;
        const direct = await directUploadWithRetry({
          bucket: 'helpdesk-media',
          pathFor: () => `${conversationId}/${Date.now()}.${ext}`,
          file: uploadFile,
          contentType: resolvedContentType,
        });
        if (direct.ok) {
          fileName = direct.path;
          if (direct.attempts > 1) normInfo = `${normInfo ? `${normInfo};` : ''}attempts:${direct.attempts}`;
        } else if (direct.kind === 'error') {
          throw new Error(direct.message);
        } else if (direct.kind === 'exhausted') {
          // Rede/hang em TODAS as tentativas. Upload lento ≠ sessão zumbi
          // (auditoria 2026-07-26): a sonda decide — só recarrega com evidência
          // de client travado ('unknown'); sessão válida = falha limpa e a
          // bolha de retry fica viva.
          const probe = await probeSession(4000);
          const decision = decideUploadTimeout(probe);
          if (decision.recoverStuck) void recoverStuckSession().catch(() => {});
          if (decision.clearDead) void clearDeadSession().catch(() => {});
          throw new Error(`${decision.errorMessage} [attempts:${direct.attempts}] ${direct.lastError}`);
        } else {
          // 'unavailable' (sem token utilizável / Storage recusou o token): o
          // storage-js refresca a sessão CORRETAMENTE — caminho legado com o
          // teto de wall-clock de sempre.
          fileName = `${conversationId}/${Date.now()}.${ext}`;
          let uploadTimer: ReturnType<typeof setTimeout> | undefined;
          const uploadTimeout = new Promise<never>((_, reject) => {
            uploadTimer = setTimeout(() => {
              void probeSession(4000).then((probe) => {
                const decision = decideUploadTimeout(probe);
                if (decision.recoverStuck) void recoverStuckSession().catch(() => {});
                if (decision.clearDead) void clearDeadSession().catch(() => {});
                reject(new Error(decision.errorMessage));
              });
            }, UPLOAD_TIMEOUT_MS);
          });
          try {
            const { error: uploadError } = await Promise.race([
              supabase.storage
                .from('helpdesk-media')
                .upload(fileName, uploadFile, { contentType: resolvedContentType }),
              uploadTimeout,
            ]);
            if (uploadError) throw uploadError;
          } finally {
            if (uploadTimer !== undefined) clearTimeout(uploadTimer);
          }
        }

        const { data: publicUrlData } = supabase.storage
          .from('helpdesk-media')
          .getPublicUrl(fileName);
        const filePublicUrl = publicUrlData.publicUrl;

        // Envia a URL PÚBLICA do Storage (UAZAPI baixa do CDN) — NÃO base64.
        // Comprovado em teste ao vivo: base64-cru é REJEITADO pelo UAZAPI
        // ("failed to decode image: unsupported image format"); a URL é aceita e
        // entregue. É o mesmo `file: <URL>` que o AI Agent usa em PROD diariamente.
        //
        // CADEIA CRUA (2026-08-12): daqui até o fim, com token utilizável no
        // localStorage, NADA passa pelo supabase client — na volta do picker de
        // foto o GoTrueClient fica travado e proxy/INSERT/UPDATE pendurariam sem
        // teto (foto subida e até ENTREGUE, mas spinner infinito e sem bolha).
        stage = 'proxy';
        const rawToken = getStoredAccessToken();
        const proxyPayload = {
          action: 'send-media',
          instance_id: instanceId,
          jid: contactJid,
          mediaUrl: filePublicUrl,
          mediaType,
          filename: isImage ? undefined : file.name,
          caption: '',
        };
        const sendResult = (rawToken
          ? await uazapiProxyRaw(rawToken, proxyPayload)
          : await uazapiProxy(proxyPayload)) as Record<string, unknown> | null;

        // NÃO marcar "enviado" sem o UAZAPI confirmar (fim do envio-fantasma):
        // sucesso = corpo sem `error` e com messageid/id. Caso contrário lança →
        // o catch mostra erro real e a msg NÃO é inserida no DB.
        stage = 'confirm';
        const sentOk = !!sendResult && !sendResult.error && (!!sendResult.messageid || !!sendResult.id);
        if (!sentOk) {
          throw new Error((sendResult?.error as string) || 'O WhatsApp não confirmou o envio. Tente novamente.');
        }

        // Save to DB
        stage = 'insert';
        const messageRow = {
          conversation_id: conversationId,
          direction: 'outgoing',
          content: isImage ? null : file.name,
          media_type: mediaType,
          media_url: filePublicUrl,
          sender_id: userId,
        };
        let insertedMsg: Tables<'conversation_messages'>;
        if (rawToken) {
          insertedMsg = await rawRestInsert<Tables<'conversation_messages'>>(
            'conversation_messages', messageRow, { accessToken: rawToken },
          );
        } else {
          const { data, error } = await supabase
            .from('conversation_messages')
            .insert(messageRow)
            .select()
            .single();
          if (error) throw error;
          insertedMsg = data;
        }

        // last_message_at + last_message são atualizados pelo trigger DB
        // `update_conversation_on_message_insert`. Aqui só atualizamos status_ia
        // (best-effort — paridade com o caminho client, que nunca checou o error).
        if (rawToken) {
          await rawRestUpdate(
            'conversations', { status_ia: STATUS_IA.DESLIGADA }, { id: conversationId }, { accessToken: rawToken },
          ).catch(() => {});
        } else {
          await supabase
            .from('conversations')
            .update({ status_ia: STATUS_IA.DESLIGADA })
            .eq('id', conversationId);
        }

        // Broadcast for realtime — com TETO: o send do canal usa o client e um
        // send pendurado não rejeita; sem o race, o envio já-concluído ficaria
        // preso aqui (os outros clients se recuperam pelo refetch/polling).
        const { broadcastNewMessage } = await import('@/lib/helpdeskBroadcast');
        await Promise.race([
          broadcastNewMessage({
            conversation_id: conversationId,
            inbox_id: inboxId,
            message_id: insertedMsg.id,
            direction: 'outgoing',
            content: isImage ? null : file.name,
            media_type: mediaType,
            media_url: filePublicUrl,
            created_at: insertedMsg.created_at,
            status_ia: STATUS_IA.DESLIGADA,
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);

        // Telemetria de SUCESSO (2026-07-26): sem ela não dá pra medir taxa de
        // falha por plataforma — a auditoria só enxergava os 2 casos que falharam.
        logSendSuccess({
          ...telemetryBase,
          detected_kind: detectedKind,
          info: `ok in ${Date.now() - startedAt}ms; upload=${uploadFile.size}B; chain=${rawToken ? 'raw' : 'client'}${normInfo ? ` (${normInfo})` : ''}`,
        });
        toast.success(isImage ? 'Imagem enviada!' : 'Documento enviado!');
        return { success: true, mediaType, mediaUrl: filePublicUrl, insertedMsg };
      } catch (err) {
        console.error('Send file error:', err);
        // Telemetria fire-and-forget (falha client-side era INVISÍVEL — nenhum
        // rastro no DB; auditoria 2026-06-09 ficou cega por isso).
        const rawMsg = err instanceof Error ? err.message : String(err);
        logSendFailure({
          ...telemetryBase,
          stage,
          outcome: /timeout/i.test(rawMsg) ? 'hang_timeout' : 'fail',
          detected_kind: detectedKind,
          // [norm:...] = o downscale/conversão rodou? [upload:...B] = tamanho
          // REAL que foi pro Storage (telemetryBase.file_size é o original)
          raw_error: `${normInfo ? `[norm:${normInfo}]` : ''}${uploadSize !== null ? `[upload:${uploadSize}B]` : ''} ${rawMsg}`.trim(),
        });
        const friendly = humanizeSendError(err, { isImage });
        toast.error(friendly);
        return { success: false, error: friendly };
      } finally {
        setSendingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    },
    [],
  );

  return { sendingFile, fileInputRef, imageInputRef, cameraInputRef, handleSendFile };
}
