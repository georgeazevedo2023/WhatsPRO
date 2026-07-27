import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { toast } from 'sonner';
import { STATUS_IA } from '@/constants/statusIa';
import { detectImageKind, normalizeImageForSend } from '@/lib/normalizeOutboundImage';
import { humanizeSendError } from '@/lib/sendErrors';
import { logSendFailure, logSendSuccess, type SendStage } from '@/lib/sendTelemetry';
import { clearDeadSession, probeSession, recoverStuckSession } from '@/lib/sessionRecovery';
import { decideUploadTimeout } from '@/lib/uploadTimeoutPolicy';
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
      // Diagnóstico da normalização (downscale/conversão) — vai na telemetria de sucesso.
      let normInfo = '';
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
        const fileName = `${conversationId}/${Date.now()}.${ext}`;

        // Upload ao Storage com TETO de wall-clock (anti sessão-zumbi): o
        // supabase-js chama getSession() ANTES do fetch e era o ÚNICO passo de
        // rede do envio sem proteção — em aba mobile retomada podia pendurar e o
        // atendente ficava com spinner infinito, sem erro e sem rastro.
        // No timeout, upload LENTO ≠ sessão ZUMBI (auditoria 2026-07-26): a
        // sonda de sessão decide — só recarrega com evidência de client travado
        // ('unknown'); sessão válida = falha limpa e a bolha de retry fica viva.
        stage = 'upload';
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

        const { data: publicUrlData } = supabase.storage
          .from('helpdesk-media')
          .getPublicUrl(fileName);
        const filePublicUrl = publicUrlData.publicUrl;

        // Envia a URL PÚBLICA do Storage (UAZAPI baixa do CDN) — NÃO base64.
        // Comprovado em teste ao vivo: base64-cru é REJEITADO pelo UAZAPI
        // ("failed to decode image: unsupported image format"); a URL é aceita e
        // entregue. É o mesmo `file: <URL>` que o AI Agent usa em PROD diariamente.
        stage = 'proxy';
        const sendResult = await uazapiProxy({
          action: 'send-media',
          instance_id: instanceId,
          jid: contactJid,
          mediaUrl: filePublicUrl,
          mediaType,
          filename: isImage ? undefined : file.name,
          caption: '',
        }) as Record<string, unknown> | null;

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
        const { data: insertedMsg, error } = await supabase
          .from('conversation_messages')
          .insert({
            conversation_id: conversationId,
            direction: 'outgoing',
            content: isImage ? null : file.name,
            media_type: mediaType,
            media_url: filePublicUrl,
            sender_id: userId,
          })
          .select()
          .single();
        if (error) throw error;

        // last_message_at + last_message são atualizados pelo trigger DB
        // `update_conversation_on_message_insert`. Aqui só atualizamos status_ia.
        await supabase
          .from('conversations')
          .update({ status_ia: STATUS_IA.DESLIGADA })
          .eq('id', conversationId);

        // Broadcast for realtime
        const { broadcastNewMessage } = await import('@/lib/helpdeskBroadcast');
        await broadcastNewMessage({
          conversation_id: conversationId,
          inbox_id: inboxId,
          message_id: insertedMsg.id,
          direction: 'outgoing',
          content: isImage ? null : file.name,
          media_type: mediaType,
          media_url: filePublicUrl,
          created_at: insertedMsg.created_at,
          status_ia: STATUS_IA.DESLIGADA,
        });

        // Telemetria de SUCESSO (2026-07-26): sem ela não dá pra medir taxa de
        // falha por plataforma — a auditoria só enxergava os 2 casos que falharam.
        logSendSuccess({
          ...telemetryBase,
          detected_kind: detectedKind,
          info: `ok in ${Date.now() - startedAt}ms; upload=${uploadFile.size}B${normInfo ? ` (${normInfo})` : ''}`,
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
          raw_error: rawMsg,
        });
        const friendly = humanizeSendError(err, { isImage });
        toast.error(friendly);
        return { success: false, error: friendly };
      } finally {
        setSendingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    },
    [],
  );

  return { sendingFile, fileInputRef, imageInputRef, handleSendFile };
}
