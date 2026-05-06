import { test, expect } from '@playwright/test';

test.describe('Onda 1F — Dashboard + Métricas + Plataforma (5 testes)', () => {
  test('1. /dashboard home carrega', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(100);
  });

  test('2. /dashboard/intelligence (Inteligência) abre', async ({ page }) => {
    await page.goto('/dashboard/intelligence');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/intelligence/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/inteligência|intelligence|análise|insight|ia|conversas/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. /dashboard/gestao (Manager Dashboard) abre', async ({ page }) => {
    await page.goto('/dashboard/gestao');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/gestao/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    // ManagerDashboard renderiza KPICards, ManagerFilters, charts
    const indicator = page.getByText(/gestão|gestao|kpi|leads|período|instância|origem|conversão|atendentes/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /dashboard/gestao/agente (Ficha Agente IA) abre', async ({ page }) => {
    await page.goto('/dashboard/gestao/agente');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/gestao\/agente/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/agente|ia|ai|qualificação|handoff|transbordo|conversas/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /dashboard/admin/roadmap abre', async ({ page }) => {
    await page.goto('/dashboard/admin/roadmap');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/admin\/roadmap/);
    await expect(page.locator('text=/algo deu errado|crashed|acesso negado/i')).toHaveCount(0);
    const indicator = page.getByText(/roadmap|fase|milestone|ship|backlog|plano/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
