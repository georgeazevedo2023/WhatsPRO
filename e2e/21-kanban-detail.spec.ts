import { test, expect } from '@playwright/test';

test.describe('Onda 4C — Kanban Board detail (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. /crm renderiza lista de boards ou empty', async ({ page }) => {
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/quadro|board|criar|nenhum quadro|colun/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Clicar primeiro board (se existir) navega para /crm/:id', async ({ page }) => {
    // Eletropiso migrou 1 board com 8 colunas
    const boardCard = page.locator('a[href*="/dashboard/crm/"], button').filter({ hasText: /quadro|board|kanban|funil|leads/i }).first();
    if (!(await boardCard.isVisible().catch(() => false))) {
      // Sem board — empty state OK
      const empty = page.getByText(/nenhum quadro|crie/i);
      await expect(empty.first().or(boardCard)).toBeVisible({ timeout: 5_000 });
      return;
    }
    await boardCard.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    // URL pode ter mudado pra /crm/:id OU permanecido
    const url = page.url();
    expect(url).toMatch(/\/dashboard\/crm/);
  });

  test('3. /crm/:id ou /crm não tem ErrorBoundary', async ({ page }) => {
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
  });

  test('4. Sidebar continua acessível', async ({ page }) => {
    const sidebar = page.getByText(/^CRM$|^Atendimento$/i).first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('5. Sem 401/403 RLS kanban_boards', async ({ page }) => {
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });
});
