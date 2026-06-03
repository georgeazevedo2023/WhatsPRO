import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { STATUS_IA } from '@/constants/statusIa';
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
  handleSendFile: (file: File, opts: SendFileOptions) => Promise<{ success: boolean; mediaType?: string; mediaUrl?: string; insertedMsg?: Tables<'conversation_messages'> }>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

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
      if (!instanceId) {
        toast.error('Instância não encontrada');
        return { success: false };
      }
      if (!contactJid) {
        toast.error('Contato sem JID');
        return { success: false };
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Arquivo deve ter no máximo 20MB');
        return { success: false };
      }

      setSendingFile(true);
      try {
        const isImage = file.type.startsWith('image/');
        const mediaType = isImage ? 'image' : 'document';

        // contentType/extensão robustos: fotos de câmera/share mobile às vezes
        // chegam com file.type vazio (Storage gravaria octet-stream) ou file.name
        // sem extensão. Como mandamos a URL pública pro UAZAPI BAIXAR do CDN, o
        // objeto PRECISA ter content-type de imagem e a URL uma extensão coerente,
        // senão o UAZAPI não decodifica ("unsupported image format").
        const resolvedContentType = file.type || (isImage ? 'image/jpeg' : 'application/octet-stream');
        const extFromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
        const extFromType = resolvedContentType.split('/')[1]?.split(';')[0];
        const ext = extFromName || extFromType || (isImage ? 'jpg' : 'bin');
        const fileName = `${conversationId}/${Date.now()}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('helpdesk-media')
          .upload(fileName, file, { contentType: resolvedContentType });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('helpdesk-media')
          .getPublicUrl(fileName);
        const filePublicUrl = publicUrlData.publicUrl;

        // Envia a URL PÚBLICA do Storage (UAZAPI baixa do CDN) — NÃO base64.
        // Comprovado em teste ao vivo: base64-cru é REJEITADO pelo UAZAPI
        // ("failed to decode image: unsupported image format"); a URL é aceita e
        // entregue. É o mesmo `file: <URL>` que o AI Agent usa em PROD diariamente.
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
        const sentOk = !!sendResult && !sendResult.error && (!!sendResult.messageid || !!sendResult.id);
        if (!sentOk) {
          throw new Error((sendResult?.error as string) || 'O WhatsApp não confirmou o envio. Tente novamente.');
        }

        // Save to DB
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

        toast.success(isImage ? 'Imagem enviada!' : 'Documento enviado!');
        return { success: true, mediaType, mediaUrl: filePublicUrl, insertedMsg };
      } catch (err) {
        handleError(err, 'Erro ao enviar documento', 'Send file error');
        return { success: false };
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
