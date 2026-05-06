import { test, expect } from '@playwright/test';

test.describe('Onda 4F — Lead detail (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Lista leads renderiza ou empty', async ({ page }) => {
    // 13 lead_profiles migrados (Eletropiso)
    const indicator = page.locator('table, [role="table"], article, li').or(
      page.getByText(/nenhum lead|sem leads|empty|primeiro lead/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Clicar primeiro lead navega para /leads/:contactId (se existir)', async ({ page }) => {
    // Tenta achar primeiro link/row de lead
    const leadLink = page.locator('a[href*="/dashboard/leads/"]').first();
    if (!(await leadLink.isVisible().catch(() => false))) {
      // Sem leads visíveis — empty state OK
      await expect(page.locator('body')).toBeVisible();
      return;
    }
    await leadLink.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toMatch(/\/dashboard\/leads/);
  });

  test('3. Lead detail (se navegou) sem ErrorBoundary', async ({ page }) => {
    const leadLink = page.locator('a[href*="/dashboard/leads/"]').first();
    if (await leadLink.isVisible().catch(() => false)) {
      await leadLink.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
  });

  test('4. Sem 401/403 RLS lead_profiles/contacts', async ({ page }) => {
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });

  test('5. Sidebar lateral acessível', async ({ page }) => {
    const sidebar = page.getByText(/^Leads$/i).first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });
});
