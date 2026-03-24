// ── UAZAPI response helpers ──────────────────────────────────────────

export interface UazapiConnectResponse {
  instance?: { qrcode?: string; status?: string };
  qrcode?: string;
  base64?: string;
  status?: string | { connected?: boolean };
  loggedIn?: boolean;
}

/** Normalize a base64 string into a valid image src. */
export const normalizeQrSrc = (qr: string): string => {
  if (qr.startsWith('data:image')) return qr;
  return `data:image/png;base64,${qr}`;
};

/** Extract a QR code string from varied UAZAPI response formats. */
export const extractQrCode = (data: UazapiConnectResponse): string | null => {
  if (data?.instance?.qrcode) return data.instance.qrcode;
  if (data?.qrcode) return data.qrcode;
  if (data?.base64) return data.base64;
  return null;
};

/** Check whether a UAZAPI response indicates a connected instance. */
export const checkIfConnected = (data: UazapiConnectResponse): boolean => {
  return (
    data?.instance?.status === 'connected' ||
    data?.status === 'connected' ||
    (typeof data?.status === 'object' && data?.status?.connected === true) ||
    data?.loggedIn === true
  );
};
