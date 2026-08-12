import { describe, it, expect, vi } from 'vitest';
import { materializeFile } from '@/lib/materializeFile';

/** File normal com os bytes dados. */
function makeFile(bytes: number[], name = 'foto.png', type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** Lê os bytes de um File (jsdom não implementa Blob.arrayBuffer — FileReader). */
function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

/** Simula o File content://-backed do Android: 1ª leitura OK, seguintes morrem. */
function oneShotFile(bytes: number[], name = '1000472422.png'): File {
  const file = makeFile(bytes, name);
  let reads = 0;
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => {
      reads += 1;
      if (reads > 1) {
        return Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError'));
      }
      return Promise.resolve(new Uint8Array(bytes).buffer);
    },
  });
  return file;
}

describe('materializeFile', () => {
  it('devolve cópia em memória com mesmos bytes/nome/tipo', async () => {
    const src = makeFile([1, 2, 3], 'a.png', 'image/png');
    const out = await materializeFile(src);
    expect(out).not.toBe(src);
    expect(out.name).toBe('a.png');
    expect(out.type).toBe('image/png');
    expect(await readBytes(out)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('cópia sobrevive a MÚLTIPLAS leituras mesmo com fonte one-shot (câmera do APK)', async () => {
    const src = oneShotFile([0x89, 0x50, 0x4e, 0x47]);
    const out = await materializeFile(src);
    expect(out).not.toBe(src);
    // A fonte morre na 2ª leitura; a cópia lê quantas vezes precisar
    // (detectImageKind no useSendFile + de novo no normalizeImageForSend).
    expect((await readBytes(out))[1]).toBe(0x50);
    expect((await readBytes(out))[2]).toBe(0x4e);
    await expect(src.arrayBuffer()).rejects.toThrow();
  });

  it('leitura que falha 2x devolve o File ORIGINAL (best-effort, nunca pior)', async () => {
    const src = makeFile([1]);
    const failing = vi.fn(() => Promise.reject(new Error('NotReadableError')));
    Object.defineProperty(src, 'arrayBuffer', { value: failing });
    const out = await materializeFile(src, { retryDelayMs: 1 });
    expect(out).toBe(src);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('retry: 1ª leitura falha (câmera ainda gravando), 2ª materializa', async () => {
    const src = makeFile([7, 8]);
    let calls = 0;
    Object.defineProperty(src, 'arrayBuffer', {
      value: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error('flush pendente'))
          : Promise.resolve(new Uint8Array([7, 8]).buffer);
      },
    });
    const out = await materializeFile(src, { retryDelayMs: 1 });
    expect(out).not.toBe(src);
    expect(await readBytes(out)).toEqual(new Uint8Array([7, 8]));
  });

  it('leitura PENDURADA cai no teto e devolve o original (stream content:// que trava)', async () => {
    const src = makeFile([1]);
    Object.defineProperty(src, 'arrayBuffer', {
      value: () => new Promise(() => {}), // nunca resolve
    });
    const out = await materializeFile(src, { timeoutMs: 20, retryDelayMs: 1 });
    expect(out).toBe(src);
  });

  it('arquivo de 0 bytes passa direto (o guard de cloud-only do envio decide)', async () => {
    const src = makeFile([]);
    const out = await materializeFile(src);
    expect(out).toBe(src);
  });

  it('arquivo acima de 50MB passa direto (não aloca RAM à toa: o envio rejeita)', async () => {
    const src = makeFile([1]);
    Object.defineProperty(src, 'size', { value: 51 * 1024 * 1024 });
    const spy = vi.fn();
    Object.defineProperty(src, 'arrayBuffer', { value: spy });
    const out = await materializeFile(src);
    expect(out).toBe(src);
    expect(spy).not.toHaveBeenCalled();
  });
});
