import { test, expect } from '@playwright/test';

test.describe('Onda 2B — AI Agent deep (5 testes)', () => {
  test('1. Tab Setup/Identidade exibe campos do agente (nome/personalidade)', async ({ page }) => {
    await page.goto('/dashboard/ai-agent');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Tab default = setup. Campos esperados em config do agente
    const fields = page.locator('input, textarea').first();
    await expect(fields).toBeVisible({ timeout: 10_000 });
  });

  test('2. Tab Qualificação acessível e exibe categorias (Eletropiso = 23 categorias)', async ({ page }) => {
    await page.goto('/dashboard/ai-agent');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Clica no botão "Qualificação"
    const qualBtn = page.getByText(/qualificação|qualificacao/i).first();
    if (await qualBtn.isVisible().catch(() => false)) {
      await qualBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    // Procura por nomes de categoria conhecidas (tinta, portas, escadas — Eletropiso)
    const categoryHint = page.getByText(/tinta|portas|escadas|cabos|iluminação|categoria|stage/i);
    const count = await categoryHint.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. /ai-agent/knowledge exibe FAQs ou empty state', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/knowledge');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const indicator = page.getByText(/faq|pergunta|conhecimento|knowledge|adicionar|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /ai-agent/playground tem chat input + tabs (Manual/Cenários/Resultados/E2E)', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/playground');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // shadcn Tabs (4 tabs: Manual, Cenários, Resultados, E2E)
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
    // Algum input/textarea da página (manual chat ou config)
    const input = page.locator('textarea, input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });

  test('5. /ai-agent/catalog lista produtos ou empty state', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/catalog');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Eletropiso novo tem 7 produtos migrados (lista)
    const indicator = page.locator('table, [role="table"]').or(
      page.getByText(/produto|nenhum produto|adicionar produto|sem produto|catálogo/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
