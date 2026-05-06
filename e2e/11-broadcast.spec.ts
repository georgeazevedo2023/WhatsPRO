import { test, expect } from '@playwright/test';

test.describe('Onda 2E — Broadcast (Disparador) (5 testes)', () => {
  test('1. /broadcast main carrega', async ({ page }) => {
    await page.goto('/dashboard/broadcast');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/broadcast/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/disparador|broadcast|disparo|grupos|leads|enviar/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /broadcast/history exibe histórico ou empty', async ({ page }) => {
    await page.goto('/dashboard/broadcast/history');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/broadcast\/history/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/histórico|historico|history|sem disparos|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /broadcast/leads (LeadsBroadcaster) carrega', async ({ page }) => {
    await page.goto('/dashboard/broadcast/leads');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/broadcast\/leads/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/leads|filtrar|importar|csv|enviar/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /broadcast/templates carrega', async ({ page }) => {
    await page.goto('/dashboard/broadcast/templates');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/broadcast\/templates/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/template|modelo|novo template|nenhum template|criar/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /scheduled (Agendamentos) carrega', async ({ page }) => {
    await page.goto('/dashboard/scheduled');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/scheduled/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/agendado|agendamento|scheduled|próximo|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
