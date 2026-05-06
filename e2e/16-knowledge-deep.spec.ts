import { test, expect } from '@playwright/test';

test.describe('Onda 3D — Knowledge profundo (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/ai-agent/knowledge');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Página renderiza header/título', async ({ page }) => {
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/conhecimento|knowledge|faq|pergunta|resposta/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Botão "Novo"/"Adicionar" FAQ presente', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /adicionar|novo|criar|nova pergunta/i });
    const count = await addBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. Lista FAQs ou empty state visível', async ({ page }) => {
    // Eletropiso migrou 13 FAQs → deve haver lista
    const indicator = page.locator('article, li, [role="listitem"]').or(
      page.getByText(/nenhum|sem perguntas|adicione|empty/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. Sem erro 401/403 (RLS ai_agent_knowledge OK)', async ({ page }) => {
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });

  test('5. Página renderiza conteúdo (não white screen)', async ({ page }) => {
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(100);
  });
});
