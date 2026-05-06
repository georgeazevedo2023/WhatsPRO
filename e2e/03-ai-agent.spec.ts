import { test, expect } from '@playwright/test';

test.describe('Onda 1C — AI Agent Config (5 testes)', () => {
  test('1. /dashboard/ai-agent abre sem error', async ({ page }) => {
    await page.goto('/dashboard/ai-agent');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/ai-agent/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('2. AI Agent renderiza tabs/seções (setup/prompt/qualificação/catálogo)', async ({ page }) => {
    await page.goto('/dashboard/ai-agent');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // AIAgentTab usa <button> próprio (não shadcn Tabs com role=tab)
    const sectionLabels = page.getByText(/setup|prompt|qualificação|qualificacao|catálogo|catalogo|conhecimento|inteligência|inteligencia/i);
    const count = await sectionLabels.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('3. /dashboard/ai-agent/catalog abre', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/catalog');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/ai-agent\/catalog/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(50);
  });

  test('4. /dashboard/ai-agent/knowledge abre', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/knowledge');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/ai-agent\/knowledge/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(50);
  });

  test('5. /dashboard/ai-agent/playground abre com chat input', async ({ page }) => {
    await page.goto('/dashboard/ai-agent/playground');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/ai-agent\/playground/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const chatInput = page.locator('textarea, input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
  });
});
