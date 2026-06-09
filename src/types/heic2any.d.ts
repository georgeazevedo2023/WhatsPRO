declare module 'heic2any' {
  interface Heic2AnyOptions {
    blob: Blob;
    /** mime de saída (default 'image/png'); usamos 'image/jpeg'. */
    toType?: string;
    /** qualidade JPEG/WEBP 0..1. */
    quality?: number;
    gifInterval?: number;
    multiple?: boolean;
  }
  /** Converte HEIC/HEIF para JPEG/PNG/WEBP no navegador (libheif-wasm). */
  function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
  export default heic2any;
}
