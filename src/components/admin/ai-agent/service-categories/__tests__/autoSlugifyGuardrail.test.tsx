import { describe, it, expect } from 'vitest';
import { calculateSlugForLabelEdit } from '../useUiMode';

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

describe('Auto-slugify guardrail (M1) — calculateSlugForLabelEdit', () => {
  describe('Modo Iniciante', () => {
    it('PRESERVA slug de item existente quando label muda', () => {
      const initialSlugs = new Set(['ambiente', 'cor', 'tipo_tinta']);
      const result = calculateSlugForLabelEdit(
        'ambiente',
        'ambiente da pintura externa',
        initialSlugs,
        'simple',
        slugify,
      );
      expect(result).toBe('ambiente'); // slug NÃO mudou — guardrail aplicou
    });

    it('AUTO-slugifica item NOVO (slug não está em initialSlugs)', () => {
      const initialSlugs = new Set(['ambiente', 'cor']);
      const result = calculateSlugForLabelEdit(
        'campo', // slug placeholder de field recém-criado
        'Acabamento Brilho',
        initialSlugs,
        'simple',
        slugify,
      );
      expect(result).toBe('acabamento_brilho');
    });

    it('Fallback: mantém slug antigo se label fica vazio', () => {
      const initialSlugs = new Set<string>();
      const result = calculateSlugForLabelEdit(
        'campo',
        '', // label vazio
        initialSlugs,
        'simple',
        slugify,
      );
      expect(result).toBe('campo'); // não vai pra '' (slugify('') retornaria '')
    });

    it('Lida com labels com acentos e espaços', () => {
      const initialSlugs = new Set<string>();
      const result = calculateSlugForLabelEdit(
        'campo',
        'Tipo de Aplicação',
        initialSlugs,
        'simple',
        slugify,
      );
      expect(result).toBe('tipo_de_aplicacao');
    });
  });

  describe('Modo Avançado', () => {
    it('NUNCA auto-slugifica em modo Avançado, mesmo para item novo', () => {
      const initialSlugs = new Set(['ambiente']);
      const result = calculateSlugForLabelEdit(
        'campo_novo',
        'Acabamento',
        initialSlugs,
        'advanced',
        slugify,
      );
      expect(result).toBe('campo_novo'); // slug intocado em modo Avançado
    });

    it('NUNCA auto-slugifica item existente em modo Avançado', () => {
      const initialSlugs = new Set(['ambiente']);
      const result = calculateSlugForLabelEdit(
        'ambiente',
        'algum novo label',
        initialSlugs,
        'advanced',
        slugify,
      );
      expect(result).toBe('ambiente');
    });
  });

  describe('Cenário real: agente Eletropiso (snapshot DB pré-execução)', () => {
    const ELETROPISO_SLUGS = new Set([
      'tintas',
      'identificacao',
      'detalhamento',
      'fechamento',
      'tipo_tinta',
      'ambiente',
      'cor',
      'acabamento',
      'marca_preferida',
      'quantidade',
      'area',
      'impermeabilizantes',
      'triagem',
      'aplicacao',
      'qualificacao_basica',
      'especificacao',
    ]);

    it('admin edita label de "ambiente" → key permanece "ambiente"', () => {
      const result = calculateSlugForLabelEdit(
        'ambiente',
        'ambiente da casa',
        ELETROPISO_SLUGS,
        'simple',
        slugify,
      );
      expect(result).toBe('ambiente');
    });

    it('admin adiciona novo field "Tipo de Imóvel" → slug auto-gerado', () => {
      const result = calculateSlugForLabelEdit(
        'campo', // placeholder de novo field
        'Tipo de Imóvel',
        ELETROPISO_SLUGS,
        'simple',
        slugify,
      );
      expect(result).toBe('tipo_de_imovel');
      expect(ELETROPISO_SLUGS.has(result)).toBe(false); // não conflita
    });
  });
});
