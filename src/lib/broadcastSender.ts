import type { CarouselData } from '@/components/broadcast/CarouselEditor';
import { uazapiProxyRaw } from '@/lib/uazapiClient';

// ─── Shared Constants ────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 4096;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const SEND_DELAY_MS = 350;
export const GROUP_DELAY_MS = 500;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4'];
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/wav'];

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface InitialData {
  messageType: string;
  content: string | null;
  mediaUrl: string | null;
  carouselData?: {
    message?: string;
    cards?: Array<{
      id?: string;
      text?: string;
      image?: string;
      buttons?: Array<{
        id?: string;
        type: 'URL' | 'REPLY' | 'CALL';
        label: string;
        value?: string;
      }>;
    }>;
  };
}

export type MediaType = 'image' | 'video' | 'audio' | 'file';
export type ActiveTab = 'text' | 'media' | 'carousel' | 'poll';

// ─── Sender Functions ────────────────────────────────────────────────────────


export const sendToNumber = async (
  instanceId: string,
  recipientJid: string,
  text: string,
  accessToken: string
) => {
  return uazapiProxyRaw(accessToken, {
    action: 'send-message',
    instance_id: instanceId,
    groupjid: recipientJid,
    message: text,
  });
};

export const sendMediaToNumber = async (
  instanceId: string,
  recipientJid: string,
  mediaData: string,
  type: string,
  captionText: string,
  docName: string,
  accessToken: string
) => {
  return uazapiProxyRaw(accessToken, {
    action: 'send-media',
    instance_id: instanceId,
    groupjid: recipientJid,
    mediaUrl: mediaData,
    mediaType: type,
    caption: captionText,
    filename: docName,
  });
};

export const sendCarouselToNumber = async (
  instanceId: string,
  recipientJid: string,
  carousel: CarouselData,
  accessToken: string,
  fileToBase64: (file: File) => Promise<string>
) => {
  const processedCards = await Promise.all(
    carousel.cards.map(async (card) => {
      let imageUrl = card.image;
      if (card.imageFile) {
        imageUrl = await fileToBase64(card.imageFile);
        const base64Data = imageUrl.split(',')[1] || imageUrl;
        imageUrl = base64Data;
      }
      return {
        text: card.text,
        image: imageUrl,
        buttons: card.buttons,
      };
    })
  );

  return uazapiProxyRaw(accessToken, {
    action: 'send-carousel',
    instance_id: instanceId,
    groupjid: recipientJid,
    message: carousel.message,
    carousel: processedCards,
  });
};

// ─── Utility Functions ───────────────────────────────────────────────────────

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};

export const compressImageToThumbnail = (file: File, maxWidth = 200, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const objectUrl = img.src;
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => resolve('');
    img.src = URL.createObjectURL(file);
  });
};

export const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}min${secs > 0 ? ` ${secs}s` : ''}`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h${remainingMins > 0 ? ` ${remainingMins}min` : ''}`;
};

export const getRandomDelay = (randomDelay: 'none' | '5-10' | '10-20', baseDelay = SEND_DELAY_MS): number => {
  if (randomDelay === 'none') return baseDelay;
  const [min, max] = randomDelay === '5-10' ? [5000, 10000] : [10000, 20000];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// M17 F4: Send poll to a single number
export const sendPollToNumber = async (
  instanceId: string,
  recipientJid: string,
  question: string,
  options: string[],
  selectableCount: number,
  accessToken: string,
  imageUrl?: string,
) => {
  // D1: Image before poll (protocol limitation — can't embed)
  if (imageUrl) {
    await uazapiProxyRaw(accessToken, {
      action: 'send-media',
      instance_id: instanceId,
      groupjid: recipientJid,
      mediaUrl: imageUrl,
      mediaType: 'image',
      caption: '',
    });
    await new Promise(r => setTimeout(r, 1500));
  }
  return uazapiProxyRaw(accessToken, {
    action: 'send-poll',
    instance_id: instanceId,
    groupjid: recipientJid,
    question,
    options,
    selectableCount,
  });
};

export const getAcceptedTypes = (mediaType: MediaType): string => {
  switch (mediaType) {
    case 'image': return ALLOWED_IMAGE_TYPES.join(',');
    case 'video': return ALLOWED_VIDEO_TYPES.join(',');
    case 'audio': return ALLOWED_AUDIO_TYPES.join(',');
    case 'file': return '*/*';
    default: return '*/*';
  }
};
