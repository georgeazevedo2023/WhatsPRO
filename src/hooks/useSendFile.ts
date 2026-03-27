import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uazapiProxy } from '@/lib/uazapiClient';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { STATUS_IA } from '@/constants/statusIa';

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
  handleSendFile: (file: File, opts: SendFileOptions) => Promise<{ success: boolean; mediaType?: string; mediaUrl?: string; insertedMsg?: any }>;
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
        // Upload to storage
        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${conversationId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('helpdesk-media')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('helpdesk-media')
          .getPublicUrl(fileName);
        const filePublicUrl = publicUrlData.publicUrl;

        // Convert to base64 for UAZAPI (using FileReader for efficiency)
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const isImage = file.type.startsWith('image/');
        const mediaType = isImage ? 'image' : 'document';

        await uazapiProxy({
          action: 'send-media',
          instance_id: instanceId,
          jid: contactJid,
          mediaUrl: dataUri,
          mediaType,
          filename: isImage ? undefined : file.name,
          caption: '',
        });

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

        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message: mediaType === 'image' ? '📷 Foto' : '📎 Documento',
            status_ia: STATUS_IA.DESLIGADA,
          })
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
