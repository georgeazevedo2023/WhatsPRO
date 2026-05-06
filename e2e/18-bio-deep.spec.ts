import { test, expect } from '@playwright/test';

test.describe('Onda 3F — Bio Page editor (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/bio-links');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Página /bio-links renderiza sem erro', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/bio-links/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/bio|link|linktree|criar|novo|adicionar/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Botão "Novo"/"Criar Bio" presente', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /novo|criar|nova|adicionar bio|nova página/i });
    const count = await newBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. Lista de bio pages ou empty state', async ({ page }) => {
    const indicator = page.locator('table, [role="table"], article, li').or(
      page.getByText(/nenhuma página|sem bio|crie|empty/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. Sem erro 401/403 (RLS bio_pages OK)', async ({ page }) => {
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });

  test('5. Página renderiza conteúdo (não white screen)', async ({ page }) => {
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(80);
  });
});
