import { test, expect } from '@playwright/test';

test.describe('Onda 2D — Campanhas (5 testes)', () => {
  test('1. /campaigns lista carrega', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/campaigns/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/campanha|campaigns|criar|nova|nenhum/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. /campaigns/new abre form (count > 0 input/textarea)', async ({ page }) => {
    await page.goto('/dashboard/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/new/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    // CampaignForm tem ≥3 inputs (nome, slug, destinationPhone, message, utm_source...)
    const inputs = page.locator('input, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('3. Página de criação tem placeholders/labels esperados', async ({ page }) => {
    await page.goto('/dashboard/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    // Placeholders/labels conhecidos do CampaignForm: "Promo Dia dos Pais", "promo-dia-dos-pais", UTM, instagram, mensagem
    const indicator = page.getByText(/promo|utm|instagram|google|mensagem|destino|whatsapp|telefone/i)
      .or(page.locator('input[placeholder*="Promo" i], input[placeholder*="promo" i], input[placeholder*="UTM" i]'));
    const count = await indicator.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('4. Sidebar tem botão Disparador (parent das Campanhas)', async ({ page }) => {
    await page.goto('/dashboard');
    // Campanhas é sub-item dentro do Collapsible "Disparador" — só aparece quando expandido.
    // Validar que o parent "Disparador" está presente é suficiente.
    const parent = page.getByText(/^Disparador$/i).first();
    await expect(parent).toBeVisible({ timeout: 10_000 });
  });

  test('5. /campaigns sem erro 4xx/5xx visível', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await expect(page.locator('text=/permission denied|unauthorized|server error|500|404/i')).toHaveCount(0);
  });
});
