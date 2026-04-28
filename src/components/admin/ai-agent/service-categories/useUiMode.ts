import { useEffect, useState } from 'react';

export type UiMode = 'simple' | 'advanced';

/**
 * Calcula o novo slug para um item dado um novo label.
 *
 * Guardrail M1: em modo Iniciante, items existentes (cujo slug está em
 * `initialSlugs`) NUNCA têm o slug regravado, mesmo quando label muda.
 * Razão: slugs são referenciados em qualification_data de leads existentes
 * e em matchers de _shared/serviceCategories.ts. Mudar = quebrar histórico.
 *
 * @param currentKey  slug atual do item (key/id)
 * @param newLabel    novo label digitado pelo usuário
 * @param initialSlugs Set de slugs presentes no carregamento inicial
 * @param uiMode      'simple' ou 'advanced'
 * @param slugifier   função pura que converte string → slug
 * @returns           novo slug, ou `currentKey` se guardrail aplicar
 */
export function calculateSlugForLabelEdit(
  currentKey: string,
  newLabel: string,
  initialSlugs: Set<string>,
  uiMode: UiMode,
  slugifier: (s: string) => string,
): string {
  // Avançado: slug é editado independente, não auto-slugify aqui
  if (uiMode === 'advanced') return currentKey;
  // Iniciante + slug existente: guardrail
  if (initialSlugs.has(currentKey)) return currentKey;
  // Iniciante + slug novo: auto-slugify
  return slugifier(newLabel) || currentKey;
}

const STORAGE_KEY = 'qualif-ui-mode';
const DEFAULT_MODE: UiMode = 'simple';

function readStoredMode(): UiMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'simple' || v === 'advanced' ? v : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function useUiMode(): [UiMode, (mode: UiMode) => void] {
  const [mode, setModeState] = useState<UiMode>(DEFAULT_MODE);

  useEffect(() => {
    setModeState(readStoredMode());
  }, []);

  const setMode = (next: UiMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota / privacy errors */
    }
  };

  return [mode, setMode];
}
