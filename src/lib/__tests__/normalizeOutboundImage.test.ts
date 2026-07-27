import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectImageKindFromBytes,
  detectImageKind,
  isUazapiSafeImageKind,
  normalizeImageForSend,
  shouldDownscaleImage,
  UNSUPPORTED_IMAGE_FORMAT,
} from '@/lib/normalizeOutboundImage';

// heic2any roda libheif-wasm (não funciona em jsdom) — mockamos.
vi.mock('heic2any', () => ({
  default: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], { type: 'image/jpeg' })),
}));

/** Monta um Uint8Array de 16 bytes começando pelos magic bytes dados. */
function magic(...head: number[]): Uint8Array {
  const arr = new Uint8Array(16);
  head.forEach((b, i) => { arr[i] = b; });
  return arr;
}

const JPEG = magic(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const PNG = magic(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const GIF = magic(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = magic(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const HEIC_MIF1 = magic(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31);
const HEIC_HEIC = magic(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
const AVIF = magic(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66);
const AVIS = magic(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73);
const BMP = magic(0x42, 0x4d, 0x36, 0x00, 0x0c, 0x00, 0x00, 0x00);
const PDF = magic(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);

/** File de imagem "grande" (> 1MB) com os magic bytes dados no início. */
function bigFile(head: Uint8Array, name: string, type = ''): File {
  const buf = new Uint8Array(1_100_000);
  buf.set(head.subarray(0, 16), 0);
  return new File([buf], name, { type });
}

describe('detectImageKindFromBytes', () => {
  it('detecta JPEG', () => expect(detectImageKindFromBytes(JPEG)).toBe('jpeg'));
  it('detecta PNG', () => expect(detectImageKindFromBytes(PNG)).toBe('png'));
  it('detecta GIF', () => expect(detectImageKindFromBytes(GIF)).toBe('gif'));
  it('detecta WEBP', () => expect(detectImageKindFromBytes(WEBP)).toBe('webp'));
  it('detecta HEIC (brand mif1, foto de iPhone/Android HEIF)', () => expect(detectImageKindFromBytes(HEIC_MIF1)).toBe('heic'));
  it('detecta HEIC (brand heic)', () => expect(detectImageKindFromBytes(HEIC_HEIC)).toBe('heic'));
  it('detecta AVIF (brand avif — antes caía em unknown e a FOTO virava documento)', () => expect(detectImageKindFromBytes(AVIF)).toBe('avif'));
  it('detecta AVIF sequência (brand avis)', () => expect(detectImageKindFromBytes(AVIS)).toBe('avif'));
  it('detecta BMP', () => expect(detectImageKindFromBytes(BMP)).toBe('bmp'));
  it('PDF é unknown (vira documento, não imagem)', () => expect(detectImageKindFromBytes(PDF)).toBe('unknown'));
  it('buffer curto é unknown', () => expect(detectImageKindFromBytes(new Uint8Array([0xff, 0xd8]))).toBe('unknown'));
});

describe('isUazapiSafeImageKind', () => {
  it('jpeg/png/gif/webp são seguros', () => {
    expect(isUazapiSafeImageKind('jpeg')).toBe(true);
    expect(isUazapiSafeImageKind('png')).toBe(true);
    expect(isUazapiSafeImageKind('gif')).toBe(true);
    expect(isUazapiSafeImageKind('webp')).toBe(true);
  });
  it('heic, avif, bmp e unknown NÃO são seguros (precisam conversão)', () => {
    expect(isUazapiSafeImageKind('heic')).toBe(false);
    expect(isUazapiSafeImageKind('avif')).toBe(false);
    expect(isUazapiSafeImageKind('bmp')).toBe(false);
    expect(isUazapiSafeImageKind('unknown')).toBe(false);
  });
});

describe('shouldDownscaleImage (fix da classe timeout — caso Alberto 4,8MB)', () => {
  it('JPEG de câmera acima de 1MB → downscale', () => {
    expect(shouldDownscaleImage('jpeg', 4_800_000)).toBe(true);
    expect(shouldDownscaleImage('jpeg', 1_000_001)).toBe(true);
  });
  it('PNG grande (print pesado) → downscale', () => {
    expect(shouldDownscaleImage('png', 2_000_000)).toBe(true);
  });
  it('JPEG/PNG pequeno passa direto (não reprocessa à toa)', () => {
    expect(shouldDownscaleImage('jpeg', 900_000)).toBe(false);
    expect(shouldDownscaleImage('png', 500_000)).toBe(false);
  });
  it('GIF/WEBP nunca (podem ser animados — downscale mataria a animação)', () => {
    expect(shouldDownscaleImage('gif', 5_000_000)).toBe(false);
    expect(shouldDownscaleImage('webp', 5_000_000)).toBe(false);
  });
  it('HEIC não passa por aqui (tem caminho próprio de conversão)', () => {
    expect(shouldDownscaleImage('heic', 5_000_000)).toBe(false);
  });
});

describe('detectImageKind (File)', () => {
  it('lê os magic bytes do File', async () => {
    const file = new File([JPEG], 'foto.jpg', { type: 'image/jpeg' });
    expect(await detectImageKind(file)).toBe('jpeg');
  });
  it('detecta HEIC mesmo com file.type vazio (caso mobile)', async () => {
    const file = new File([HEIC_MIF1], 'IMG_0001.HEIC', { type: '' });
    expect(await detectImageKind(file)).toBe('heic');
  });
});

describe('normalizeImageForSend', () => {
  beforeEach(() => vi.clearAllMocks());

  it('JPEG passa direto (sem conversão)', async () => {
    const file = new File([JPEG], 'foto.jpg', { type: 'image/jpeg' });
    const out = await normalizeImageForSend(file);
    expect(out.converted).toBe(false);
    expect(out.kind).toBe('jpeg');
    expect(out.contentType).toBe('image/jpeg');
    expect(out.ext).toBe('jpg');
    expect(out.file).toBe(file);
  });

  it('PNG passa direto com ext/contentType corretos', async () => {
    const file = new File([PNG], 'print.png', { type: 'image/png' });
    const out = await normalizeImageForSend(file);
    expect(out.converted).toBe(false);
    expect(out.kind).toBe('png');
    expect(out.contentType).toBe('image/png');
    expect(out.ext).toBe('png');
  });

  it('WEBP passa direto', async () => {
    const file = new File([WEBP], 'x.webp', { type: 'image/webp' });
    const out = await normalizeImageForSend(file);
    expect(out.converted).toBe(false);
    expect(out.contentType).toBe('image/webp');
  });

  it('HEIC é convertido para JPEG (heic2any)', async () => {
    const heic2any = (await import('heic2any')).default as unknown as ReturnType<typeof vi.fn>;
    const file = new File([HEIC_MIF1], 'IMG_0001.HEIC', { type: 'image/heic' });
    const out = await normalizeImageForSend(file);
    expect(heic2any).toHaveBeenCalledOnce();
    expect(out.converted).toBe(true);
    expect(out.downscaled).toBe(false); // resultado pequeno → não re-encoda de novo
    expect(out.kind).toBe('heic');
    expect(out.contentType).toBe('image/jpeg');
    expect(out.ext).toBe('jpg');
    expect(out.file.name).toBe('IMG_0001.jpg');
    expect(out.file.type).toBe('image/jpeg');
  });

  // jsdom não decodifica imagem (Image.onload nunca dispara / createObjectURL
  // ausente) — o canvasTimeoutMs curto força o caminho de FALHA do canvas, que
  // é exatamente o contrato sob teste: downscale é BEST-EFFORT e nunca pode
  // quebrar um envio que hoje funciona.
  it('JPEG grande: se o downscale falhar, envia o ORIGINAL (nunca piora)', async () => {
    const file = bigFile(JPEG, 'IMG_2077.jpg', 'image/jpeg');
    const out = await normalizeImageForSend(file, { canvasTimeoutMs: 100 });
    expect(out.file).toBe(file);
    expect(out.converted).toBe(false);
    expect(out.downscaled).toBe(false);
    expect(out.contentType).toBe('image/jpeg');
  });

  it('JPEG pequeno NÃO tenta downscale (passa direto, mesmo objeto)', async () => {
    const file = new File([JPEG], 'foto.jpg', { type: 'image/jpeg' });
    const out = await normalizeImageForSend(file, { canvasTimeoutMs: 100 });
    expect(out.file).toBe(file);
    expect(out.downscaled).toBe(false);
  });

  it('AVIF entra no caminho de IMAGEM e falha TIPADO se não decodificar (nunca vira documento mudo)', async () => {
    const file = new File([AVIF], 'IMG_555.avif', { type: '' });
    await expect(normalizeImageForSend(file, { canvasTimeoutMs: 100 }))
      .rejects.toThrow(UNSUPPORTED_IMAGE_FORMAT);
  });
});

describe('UNSUPPORTED_IMAGE_FORMAT', () => {
  it('é a sentinela usada para erro humanizado', () => {
    expect(UNSUPPORTED_IMAGE_FORMAT).toBe('UNSUPPORTED_IMAGE_FORMAT');
  });
});
