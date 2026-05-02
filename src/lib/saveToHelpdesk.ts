import { supabase } from '@/integrations/supabase/client';
import { getAlternateBrazilianJid, normalizePhoneForMatch } from '@/lib/phoneUtils';

interface HelpdeskMessageData {
  content: string | null;
  media_type: string; // 'text' | 'image' | 'video' | 'audio' | 'document' | 'carousel'
  media_url?: string | null;
}

/**
 * After a successful broadcast send, save the outgoing message to the HelpDesk
 * so it appears in the conversation history.
 */
export const saveToHelpdesk = async (
  instanceId: string,
  contactJid: string,
  contactPhone: string,
  contactName: string | null,
  messageData: HelpdeskMessageData
): Promise<void> => {
  try {
    // 1. Find inbox linked to this instance
    const { data: inbox } = await supabase
      .from('inboxes')
      .select('id')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (!inbox) {
      // No inbox configured for this instance – skip silently
      return;
    }

    // 2. Find contact by JID first, then fallback to phone number matching
    let contactId: string | null = null;

    const { data: exactContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('jid', contactJid)
      .maybeSingle();

    if (exactContact) {
      contactId = exactContact.id;
      // Update name if we have a better one
      if (contactName) {
        await supabase
          .from('contacts')
          .update({ name: contactName })
          .eq('id', contactId);
      }
    } else {
      // Fallback 1: tenta variação do 9º dígito (BR). Helper canônico em phoneUtils.
      const altJid = getAlternateBrazilianJid(contactJid);

      if (altJid) {
        const { data: altContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('jid', altJid)
          .maybeSingle();

        if (altContact) {
          contactId = altContact.id;
          if (contactName) {
            await supabase
              .from('contacts')
              .update({ name: contactName })
              .eq('id', contactId);
          }
        }
      }

      // Fallback 2: Search by phone suffix (last 10-11 digits) directly in DB
      if (!contactId) {
        const suffix = normalizePhoneForMatch(contactPhone);
        const { data: phoneMatch } = await supabase
          .from('contacts')
          .select('id')
          .ilike('phone', `%${suffix}`)
          .limit(1)
          .maybeSingle();

        if (phoneMatch) {
          contactId = phoneMatch.id;
          if (contactName) {
            await supabase
              .from('contacts')
              .update({ name: contactName })
              .eq('id', contactId);
          }
        }
      }

      if (!contactId) {
        // Create new contact
        const { data: newContact, error: insertErr } = await supabase
          .from('contacts')
          .insert({
            jid: contactJid,
            phone: contactPhone,
            name: contactName,
          })
          .select('id')
          .single();

        if (insertErr || !newContact) {
          console.error('[saveToHelpdesk] Error creating contact:', insertErr);
          return;
        }
        contactId = newContact.id;
      }
    }

    // 3. Find open/pending conversation or create new one
    const now = new Date().toISOString();

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('inbox_id', inbox.id)
      .eq('contact_id', contactId)
      .in('status', ['aberta', 'pendente'])
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      // last_message_at + last_message são atualizados pelo trigger
      // `update_conversation_on_message_insert` quando a mensagem entrar no INSERT abaixo.
      // updated_at é atualizado pelo trigger BEFORE UPDATE existente quando alguma coluna mudar.
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          inbox_id: inbox.id,
          contact_id: contactId,
          status: 'aberta',
          last_message_at: now,
        })
        .select('id')
        .single();

      if (convErr || !newConv) {
        console.error('[saveToHelpdesk] Error creating conversation:', convErr);
        return;
      }
      conversationId = newConv.id;
    }

    // 4. Insert message into conversation_messages
    const { error: msgErr } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outgoing',
        content: messageData.content,
        media_type: messageData.media_type,
        media_url: messageData.media_url || null,
      });

    if (msgErr) {
      console.error('[saveToHelpdesk] Error inserting message:', msgErr);
      return;
    }

    // 5. Broadcast realtime update for HelpDesk
    const channel = supabase.channel('helpdesk-conversations');
    await channel.send({
      type: 'broadcast',
      event: 'conversation_updated',
      payload: { conversation_id: conversationId, inbox_id: inbox.id },
    });
    supabase.removeChannel(channel);
  } catch (err) {
    console.error('[saveToHelpdesk] Unexpected error:', err);
  }
};
