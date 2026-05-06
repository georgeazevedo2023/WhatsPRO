import { test, expect } from '@playwright/test';

test.describe('Onda 3A — Métricas profundas (5 testes)', () => {
  test('1. /gestao/transbordo (Painel Transbordo) abre', async ({ page }) => {
    await page.goto('/dashboard/gestao/transbordo');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/gestao\/transbordo/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/transbordo|handoff|motivo|pickup|pendente|atendente/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /gestao/origem (Métricas Origem) abre', async ({ page }) => {
    await page.goto('/dashboard/gestao/origem');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/gestao\/origem/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/origem|canal|utm|atribuição|atribuicao|whatsapp|bio|campanha/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /gestao (Manager) tem cards de KPI/charts', async ({ page }) => {
    await page.goto('/dashboard/gestao');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // ManagerDashboard tem ManagerKPICards + 5 charts + GoalProgressBar + DbSizeCard
    const indicator = page.getByText(/leads|conversão|conversao|atendentes|período|periodo|ranking|kpi/i);
    const count = await indicator.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('4. /gestao tem filtros (instância + período)', async ({ page }) => {
    await page.goto('/dashboard/gestao');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // ManagerFilters tem select de instância + período
    const filters = page.locator('button[role="combobox"], select');
    const count = await filters.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('5. /assistant widget aceita texto no input', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const input = page.locator('textarea, input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    // Aceita digitar (sem submeter — assistente envia ao server real)
    await input.fill('teste digitar');
    await expect(input).toHaveValue('teste digitar');
  });
});
