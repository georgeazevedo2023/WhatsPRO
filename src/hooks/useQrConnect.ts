import { useState, useRef, useEffect, useCallback } from 'react';
import type { Instance } from '@/types';
import { uazapiProxy } from '@/lib/uazapiClient';
import { normalizeQrSrc, extractQrCode, checkIfConnected } from '@/lib/uazapiUtils';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';

export interface UseQrConnectOptions {
  /** Called when the instance connects successfully */
  onConnected?: () => void;
  /** Polling interval in ms (default 5000) */
  pollInterval?: number;
}

export interface UseQrConnectReturn {
  qrCode: string | null;
  isLoadingQr: boolean;
  isPolling: boolean;
  /** The instance currently being connected */
  activeInstance: Instance | null;
  /** Initiate QR connect flow for an instance */
  connect: (instance: Instance) => Promise<void>;
  /** Re-generate QR for the current active instance */
  regenerateQr: () => void;
  /** Stop polling and reset all state */
  close: () => void;
  /**
   * Open QR dialog with a pre-obtained QR code (e.g. after instance creation).
   * Also starts polling automatically.
   */
  openWithQr: (instance: Instance, qr: string) => void;
}

export function useQrConnect(options: UseQrConnectOptions = {}): UseQrConnectReturn {
  const { onConnected, pollInterval = 5000 } = options;

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [activeInstance, setActiveInstance] = useState<Instance | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    stopPolling();
    setQrCode(null);
    setIsLoadingQr(false);
    setActiveInstance(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(
    (instance: Instance) => {
      stopPolling();

      pollingRef.current = setInterval(async () => {
        try {
          const data = await uazapiProxy({
            action: 'status',
            instance_id: instance.id,
          });

          if (checkIfConnected(data)) {
            stopPolling();
            toast.success('Conectado com sucesso!');
            setQrCode(null);
            setActiveInstance(null);
            onConnectedRef.current?.();
          }
        } catch {
          // Silently retry on next tick
        }
      }, pollInterval);
    },
    [stopPolling, pollInterval],
  );

  const connect = useCallback(
    async (instance: Instance) => {
      setActiveInstance(instance);
      setIsLoadingQr(true);
      setQrCode(null);

      try {
        const data = await uazapiProxy({
          action: 'connect',
          instanceName: instance.name,
          instance_id: instance.id,
        });

        if (checkIfConnected(data)) {
          toast.success('Instância já está conectada!');
          setActiveInstance(null);
          onConnectedRef.current?.();
          return;
        }

        const qr = extractQrCode(data);
        if (qr) {
          setQrCode(normalizeQrSrc(qr));
          startPolling(instance);
        } else {
          handleError('Não foi possível gerar o QR Code', 'Não foi possível gerar o QR Code', 'QR code not found in response');
        }
      } catch (error) {
        handleError(error, 'Erro ao gerar QR Code', 'Error connecting');
      } finally {
        setIsLoadingQr(false);
      }
    },
    [startPolling],
  );

  const regenerateQr = useCallback(() => {
    if (activeInstance) {
      connect(activeInstance);
    }
  }, [activeInstance, connect]);

  const openWithQr = useCallback(
    (instance: Instance, qr: string) => {
      setActiveInstance(instance);
      setQrCode(normalizeQrSrc(qr));
      startPolling(instance);
    },
    [startPolling],
  );

  return {
    qrCode,
    isLoadingQr,
    isPolling: pollingRef.current !== null,
    activeInstance,
    connect,
    regenerateQr,
    close,
    openWithQr,
  };
}
