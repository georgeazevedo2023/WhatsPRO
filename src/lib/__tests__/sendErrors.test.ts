import { describe, it, expect } from 'vitest';
import { humanizeSendError } from '@/lib/sendErrors';
import {
  UNSUPPORTED_IMAGE_FORMAT,
  CHUNK_LOAD_FAILED,
  HEIC_CONVERSION_FAILED,
  HEIC_CONVERSION_TIMEOUT,
} from '@/lib/normalizeOutboundImage';

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

  // ── Auditoria 2026-06-09 (vendedores Android sem enviar foto) ──────────
  it('chunk 404 pós-deploy ("Failed to fetch dynamically imported module") vira "recarregue a página"', () => {
    const out = humanizeSendError(
      new Error('Failed to fetch dynamically imported module: https://crm.wsmart.com.br/assets/heic2any-Cxfjnf1K.js'),
      { isImage: true },
    );
    expect(out.toLowerCase()).toContain('recarregue');
    expect(out).not.toContain('dynamically');
  });

  it('sentinela CHUNK_LOAD_FAILED também vira "recarregue a página"', () => {
    const out = humanizeSendError(new Error(CHUNK_LOAD_FAILED), { isImage: true });
    expect(out.toLowerCase()).toContain('recarregue');
  });

  it('erros do heic2any (ERR_LIBHEIF / cannot enlarge memory) viram mensagem de conversão HEIC com dica de print', () => {
    expect(humanizeSendError(new Error('ERR_LIBHEIF format not supported'), { isImage: true }).toLowerCase()).toContain('print');
    expect(humanizeSendError(new Error('Cannot enlarge memory arrays'), { isImage: true }).toLowerCase()).toContain('heic');
  });

  it('heic2any rejeita com OBJETO {code,message} (não Error) — a message real é usada', () => {
    const out = humanizeSendError({ code: 1, message: 'ERR_LIBHEIF format not supported' }, { isImage: true });
    expect(out.toLowerCase()).toContain('heic');
  });

  it('sentinelas tipadas HEIC_CONVERSION_FAILED/TIMEOUT mapeiam pra conversão HEIC (não pro timeout genérico)', () => {
    expect(humanizeSendError(new Error(`${HEIC_CONVERSION_FAILED}: worker died`), { isImage: true }).toLowerCase()).toContain('heic');
    expect(humanizeSendError(new Error(HEIC_CONVERSION_TIMEOUT), { isImage: true }).toLowerCase()).toContain('heic');
  });

  it('sessão expirada/JWT/RLS vira "sessão expirou"', () => {
    expect(humanizeSendError(new Error('JWT expired'), { isImage: true }).toLowerCase()).toContain('sessão');
    expect(humanizeSendError(new Error('new row violates row-level security policy'), { isImage: true }).toLowerCase()).toContain('sessão');
  });

  it('upload timeout (sessão zumbi) cai na mensagem de demora', () => {
    const out = humanizeSendError(new Error('upload timeout: o envio demorou demais (conexão ou sessão)'), { isImage: true });
    expect(out.toLowerCase()).toContain('demorou');
  });

  it('"mídia" COM acento também casa a mensagem de não-confirmação', () => {
    const out = humanizeSendError('falha ao entregar a mídia', { isImage: true });
    expect(out.toLowerCase()).toContain('whatsapp');
  });

  it('arquivo de 0 bytes (foto cloud-only do Google Fotos) vira dica da nuvem', () => {
    const out = humanizeSendError(new Error('empty file'), { isImage: true });
    expect(out.toLowerCase()).toContain('nuvem');
  });
});
