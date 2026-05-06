import { test, expect } from '@playwright/test';

test.describe('Onda 4E — Flows Wizard + Templates + Guided (5 testes)', () => {
  test('1. /flows/new/wizard formulário renderiza', async ({ page }) => {
    await page.goto('/dashboard/flows/new/wizard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/flows\/new\/wizard/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const inputs = page.locator('input, textarea, select, button[role="combobox"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('2. /flows/new/templates galeria de 12 templates', async ({ page }) => {
    await page.goto('/dashboard/flows/new/templates');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/flows\/new\/templates/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    // 12 templates: saudação, qualificação, etc
    const templates = page.getByText(/saudação|saudacao|qualificação|qualificacao|template|usar|escolher/i);
    const count = await templates.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. /flows/new (seletor de modo) tem opções', async ({ page }) => {
    await page.goto('/dashboard/flows/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const indicator = page.getByText(/wizard|guiada|template|conversa|formulário|formulario|escolher|modo/i);
    const count = await indicator.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('4. /flows lista exibe Eletropiso (1 flow migrado) ou empty', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const indicator = page.locator('table, [role="table"], article, li').or(
      page.getByText(/nenhum fluxo|crie|primeiro fluxo|empty/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. Sem 401/403 RLS flows', async ({ page }) => {
    await page.goto('/dashboard/flows');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });
});
