import { test, expect } from '@playwright/test';

test.describe('Onda 1A — Auth + Smoke (5 testes)', () => {
  test('1. /dashboard carrega com sessão autenticada (storageState)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toBeVisible();
    // Sidebar/nav presente (qualquer um dos roles)
    await expect(page.locator('aside, nav, [role="navigation"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Sidebar contém label "Atendimento"', async ({ page }) => {
    await page.goto('/dashboard');
    // Atendimento é um <button> com TooltipTrigger, não <a role=link>. Usar texto direto.
    await expect(page.getByText(/^Atendimento$/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. Login inválido mostra erro/falha', async ({ page, context }) => {
    // Limpa toda sessão antes (cookies + storage)
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Recarrega /login pra garantir state limpo
    await page.goto('/login');
    // Espera form aparecer (sem redirect)
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
    await page.locator('#login-email').fill('naoexiste@nope.com');
    await page.locator('#login-password').fill('senhainvalida_xxxxx');
    await page.getByRole('button', { name: /^entrar/i }).click();
    // Aceita qualquer indicação: toast, ficar em /login, ou erro inline.
    await page.waitForTimeout(3500);
    expect(page.url()).toMatch(/\/login/);
  });

  test('4. Acesso direto a /login com sessão válida redireciona pra /dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('5. /dashboard sem auth redireciona pra /login', async ({ page, context }) => {
    await context.clearCookies();
    // Limpa localStorage do app (Supabase guarda token lá)
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/dashboard');
    // Deve voltar pra /login (com tolerância maior pelo AuthContext)
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/login/);
  });
});
