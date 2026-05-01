import { useState, useEffect, useRef } from 'react';

/**
 * Drop-in replacement de `useState` que sincroniza com `sessionStorage`.
 *
 * - **Per-tab**: cada aba do navegador tem seu próprio storage (sessionStorage).
 *   Não compartilha entre abas — bom pro caso de "refresh acidental" sem
 *   colisão entre janelas paralelas.
 * - **JSON-safe**: serializa/desserializa o valor. Não serve para tipos com
 *   ciclos, Date, Map, Set etc — use só com tipos JSON-puros.
 * - **SSR-safe**: durante o render no servidor (sem `window`), comporta-se
 *   como `useState` normal e só reidrata no primeiro `useEffect` do cliente.
 *
 * Uso:
 *   const [tab, setTab] = usePersistedState('aiagent.activeTab', 'setup');
 *
 * Limpeza manual (ex: ao concluir um wizard):
 *   sessionStorage.removeItem('aiagent.csvImport.<agentId>')
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialRef = useRef(initial);

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialRef.current;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return initialRef.current;
      return JSON.parse(raw) as T;
    } catch {
      return initialRef.current;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // QuotaExceeded ou disabled storage — ignora silenciosamente.
    }
  }, [key, state]);

  return [state, setState];
}

/** Helper para limpar uma chave persistida (chamada manual em fluxos finalizados). */
export function clearPersistedState(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
