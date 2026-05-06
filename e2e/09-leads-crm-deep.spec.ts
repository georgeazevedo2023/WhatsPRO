import { test, expect } from '@playwright/test';

test.describe('Onda 2C — Leads + CRM deep (5 testes)', () => {
  test('1. /leads exibe filtro/busca e tabela ou empty', async ({ page }) => {
    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const searchOrTable = page.locator('input[type="search"], input[placeholder*="usca" i]').or(
      page.locator('table, [role="table"]')
    ).or(page.getByText(/nenhum lead|sem leads/i));
    await expect(searchOrTable.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Sidebar contém link CRM/Leads', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.getByText(/^Leads$|^CRM$|^Kanban$/i);
    const count = await link.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. /crm Kanban exibe placeholder de board ou board ativo', async ({ page }) => {
    await page.goto('/dashboard/crm');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Lista de boards OU board direto OU empty + botão "criar"
    const indicator = page.getByText(/quadro|board|criar.*quadro|nenhum quadro|colun/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. /funnels exibe lista de funis ou empty + criar', async ({ page }) => {
    await page.goto('/dashboard/funnels');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const indicator = page.getByText(/funil|funnel|criar funil|novo funil|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. /funnels/new abre wizard sem error', async ({ page }) => {
    await page.goto('/dashboard/funnels/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/funnels\/new/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/wizard|criar|nome|tipo|template/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });
});
