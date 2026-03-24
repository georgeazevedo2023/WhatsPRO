/**
 * Shared phone/JID formatting utilities for WhatsApp numbers.
 *
 * Centralized module for all phone/JID operations. Use these instead of
 * inline parsing/formatting. Brazilian number format:
 *   55 (DDI) + DDD (2 digits) + 9? (optional) + number (8 digits)
 *   Full JID: "5511999999999@s.whatsapp.net"
 */

/** Extract digits from a JID, removing the @domain suffix */
export const jidToDigits = (jid: string): string => {
  return jid.replace(/@.*$/, '').replace(/\D/g, '');
};

/** Check if a JID is a group (ends with @g.us) */
export const isGroupJid = (jid: string): boolean => {
  return jid.endsWith('@g.us');
};

/** Get the alternate Brazilian JID (toggle the 9th digit) */
export const getAlternateBrazilianJid = (jid: string): string | null => {
  const digits = jidToDigits(jid);
  if (!digits.startsWith('55')) return null;
  // 13 digits → remove the 9 after DDD
  if (digits.length === 13) {
    return '55' + digits.slice(2, 4) + digits.slice(5) + '@s.whatsapp.net';
  }
  // 12 digits → add the 9 after DDD
  if (digits.length === 12) {
    return '55' + digits.slice(2, 4) + '9' + digits.slice(4) + '@s.whatsapp.net';
  }
  return null;
};

/**
 * Normalize a phone number for matching (last 10-11 digits = DDD + number).
 * Avoids false positives from using only 8 digits.
 */
export const normalizePhoneForMatch = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 11) return digits.slice(-11);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

/** Format a WhatsApp JID (e.g. "5511999999999@s.whatsapp.net") into a readable phone string */
export const formatPhone = (jid: string | null): string => {
  if (!jid) return '';
  const clean = jid.replace(/@.*$/, '');
  if (!clean) return '';
  if (clean.length === 13)
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12)
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return clean;
};

/** Format a JID stripping domain — returns just digits or 'Desconhecido' */
export const formatPhoneSimple = (jid: string): string => {
  if (!jid) return 'Desconhecido';
  const phone = jid.split('@')[0];
  return phone || 'Desconhecido';
};

/** Format phone for display with +DDI DDD XXXXX-XXXX pattern */
export const formatPhoneForDisplay = (phone: string): string => {
  let number = phone.replace(/[^\d]/g, '');
  if (!number || number.length < 10) return phone;
  if (!number.startsWith('55') && number.length <= 11) {
    number = '55' + number;
  }
  if (number.length >= 12) {
    const ddi = number.slice(0, 2);
    const ddd = number.slice(2, 4);
    const parte1 = number.slice(4, 9);
    const parte2 = number.slice(9);
    return `+${ddi} ${ddd} ${parte1}-${parte2}`;
  }
  return phone;
};

/** Format phone display without + prefix: "DDI DDD NUMBER" */
export const formatPhoneDisplay = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 12) {
    const ddi = cleaned.slice(0, 2);
    const ddd = cleaned.slice(2, 4);
    const number = cleaned.slice(4);
    return `${ddi} ${ddd} ${number}`;
  }
  return cleaned;
};

/** Parse a phone number string into a JID format (e.g. "5511999999999@s.whatsapp.net") */
export const parsePhoneToJid = (phone: string): string | null => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
};
