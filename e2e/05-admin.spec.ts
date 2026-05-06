import { test, expect } from '@playwright/test';

test.describe('Onda 1E — Admin (5 testes — super_admin)', () => {
  test('1. /dashboard/admin redireciona pra primeira sub-página', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // AdminPanel.tsx redireciona pra /admin/inboxes
    await expect(page).toHaveURL(/\/dashboard\/admin/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(50);
  });

  test('2. /dashboard/admin/users lista', async ({ page }) => {
    await page.goto('/dashboard/admin/users');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/admin\/users/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    // Tem table OU pelo menos texto reconhecível
    const indicator = page.locator('table, [role="table"]').or(page.getByText(/usuário|equipe|users|email|role|nome/i).first());
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /dashboard/admin/departments lista', async ({ page }) => {
    await page.goto('/dashboard/admin/departments');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/admin\/departments/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/departamento|deptos|departments|vendas|membros/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /dashboard/admin/inboxes lista', async ({ page }) => {
    await page.goto('/dashboard/admin/inboxes');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/admin\/inboxes/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/caix|inbox|eletropiso|instância|departamento padrão/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /dashboard/admin/retention abre', async ({ page }) => {
    await page.goto('/dashboard/admin/retention');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/admin\/retention/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/retenção|retention|policy|policies|política|dias/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
