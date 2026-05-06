import { test, expect } from '@playwright/test';

test.describe('Onda 3B — Admin profundo (5 testes)', () => {
  test('1. /admin/secrets abre', async ({ page }) => {
    await page.goto('/dashboard/admin/secrets');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/admin\/secrets/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/secret|api key|token|credencial|chave/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /admin/docs abre', async ({ page }) => {
    await page.goto('/dashboard/admin/docs');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/admin\/docs/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/documentação|documentacao|docs|prd|architecture|wiki|markdown/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /admin/backup abre', async ({ page }) => {
    await page.goto('/dashboard/admin/backup');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/admin\/backup/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/backup|jsonl|bucket|gzip|baixar|download|histórico/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /admin/users tem botão "Novo" ou "Adicionar"', async ({ page }) => {
    await page.goto('/dashboard/admin/users');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const newBtn = page.getByRole('button', { name: /novo|adicionar|criar|convidar|invite/i });
    const count = await newBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('5. /admin/inboxes mostra Eletropiso na lista (D-α default_dept)', async ({ page }) => {
    await page.goto('/dashboard/admin/inboxes');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const indicator = page.getByText(/eletropiso/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
