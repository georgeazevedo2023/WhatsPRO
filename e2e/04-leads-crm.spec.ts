import { test, expect } from '@playwright/test';

test.describe('Onda 1D — Leads + CRM + Catálogo + Funis + Bio (5 testes)', () => {
  test('1. /dashboard/leads lista carrega', async ({ page }) => {
    await page.goto('/dashboard/leads');
    await expect(page).toHaveURL(/\/dashboard\/leads/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    await expect(page.locator('h1, h2').filter({ hasText: /leads/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /dashboard/crm Kanban carrega', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await expect(page).toHaveURL(/\/dashboard\/crm/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    // Lista de boards OU board direto OU empty state
    await expect(page.locator('h1, h2').filter({ hasText: /crm|kanban|quadro|board/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /dashboard/funnels carrega', async ({ page }) => {
    await page.goto('/dashboard/funnels');
    await expect(page).toHaveURL(/\/dashboard\/funnels/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    await expect(page.locator('h1, h2').filter({ hasText: /funil|funis|funnel/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /dashboard/bio-links carrega', async ({ page }) => {
    await page.goto('/dashboard/bio-links');
    await expect(page).toHaveURL(/\/dashboard\/bio-links/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    await expect(page.locator('h1, h2').filter({ hasText: /bio|link/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /dashboard/forms carrega', async ({ page }) => {
    await page.goto('/dashboard/forms');
    await expect(page).toHaveURL(/\/dashboard\/forms/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    await expect(page.locator('h1, h2').filter({ hasText: /formul|form/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
