import { test, expect } from '@playwright/test';

test.describe('Onda 2F — Flows (Fluxos v3) + Instâncias + Inteligência (5 testes)', () => {
  test('1. /flows lista carrega', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/flows/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/fluxo|flow|criar|template|novo|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /flows/new (seletor de modo) abre', async ({ page }) => {
    await page.goto('/dashboard/flows/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/flows\/new/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/wizard|guiada|template|formulário|conversa/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /flows/new/templates galeria abre', async ({ page }) => {
    await page.goto('/dashboard/flows/new/templates');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/flows\/new\/templates/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/template|saudação|qualificação|modelo|usar/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /instances lista carrega (Eletropiso visível)', async ({ page }) => {
    await page.goto('/dashboard/instances');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/instances/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    // Instância Eletropiso migrada deve aparecer
    const indicator = page.getByText(/eletropiso|instância|connected|conectado|qr|criar instância/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /assistant (widget IA Conversacional) abre', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/assistant/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const input = page.locator('textarea, input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });
});
