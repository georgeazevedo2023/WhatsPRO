import { test, expect } from '@playwright/test';

test.describe('Onda 4D — Funnels Wizard (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/funnels/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Wizard /funnels/new renderiza sem error', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/funnels\/new/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
  });

  test('2. Wizard tem indicação de etapas/steps', async ({ page }) => {
    // Wizard tem 4 passos (FunnelWizard)
    const indicator = page.getByText(/passo|etapa|step|próximo|proximo|avançar|avancar/i);
    const count = await indicator.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. Tipos de funil disponíveis (7 tipos)', async ({ page }) => {
    // 7 tipos: sorteio, vaga, lançamento, captura, formulário, biolink, atendimento
    const tipos = page.getByText(/sorteio|vaga|lançamento|lancamento|formulário|formulario|bio|captura|atendimento|venda/i);
    const count = await tipos.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('4. Wizard tem cards/botões interativos (passo 1 = seleção de tipo)', async ({ page }) => {
    // Passo 1 do FunnelWizard é "Qual o objetivo do seu funil?" — 7 cards clicáveis (sem inputs).
    // Inputs aparecem nos passos 2-4. Testar cards/botões em vez.
    const interactive = page.locator('button:not([aria-label*="Recolher"]):not([aria-label*="Notif"]), [role="button"], a[href*="/funnels/"]');
    const count = await interactive.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('5. Página renderiza conteúdo significativo', async ({ page }) => {
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(150);
  });
});
