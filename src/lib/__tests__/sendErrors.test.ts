import { describe, it, expect } from 'vitest';
import { humanizeSendError } from '@/lib/sendErrors';
import { UNSUPPORTED_IMAGE_FORMAT } from '@/lib/normalizeOutboundImage';

describe('humanizeSendError', () => {
  it('formato não suportado vira mensagem sobre formato/JPEG (não a string técnica)', () => {
    const out = humanizeSendError(new Error('failed to convert image to JPEG: failed to decode image: unsupported image format'), { isImage: true });
    expect(out.toLowerCase()).toContain('formato');
    expect(out).toContain('JPEG');
    expect(out).not.toContain('decode');
  });

  it('a sentinela UNSUPPORTED_IMAGE_FORMAT também mapeia para formato', () => {
    const out = humanizeSendError(new Error(UNSUPPORTED_IMAGE_FORMAT), { isImage: true });
    expect(out.toLowerCase()).toContain('formato');
  });

  it('timeout vira mensagem sobre demora (não "timed out after 30000ms")', () => {
    const out = humanizeSendError(new Error('Request to https://x/send/media timed out after 60000ms'), { isImage: true });
    expect(out.toLowerCase()).toContain('demorou');
    expect(out).not.toContain('timed out');
  });

  it('erro de tamanho vira mensagem sobre arquivo grande', () => {
    const out = humanizeSendError('payload too large (413)', { isImage: false });
    expect(out.toLowerCase()).toMatch(/grande/);
  });

  it('502/WhatsApp recusou vira mensagem de não-confirmação', () => {
    const out = humanizeSendError('O WhatsApp não confirmou o envio.', { isImage: true });
    expect(out.toLowerCase()).toContain('whatsapp');
  });

  it('erro genérico não vaza string crua e diferencia imagem/arquivo', () => {
    expect(humanizeSendError('boom xyz', { isImage: true })).toBe('Não foi possível enviar a imagem. Tente de novo.');
    expect(humanizeSendError('boom xyz', { isImage: false })).toBe('Não foi possível enviar o arquivo. Tente de novo.');
  });
});
