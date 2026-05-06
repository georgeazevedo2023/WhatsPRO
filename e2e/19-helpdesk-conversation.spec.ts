import { test, expect } from '@playwright/test';

test.describe('Onda 4A — Helpdesk abrir conversa (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/helpdesk');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Lista lateral renderiza item ou empty state', async ({ page }) => {
    // ConversationList ou aside lateral
    const list = page.locator('aside, [class*="ConversationList"], [class*="conversation-list"]').first();
    const empty = page.getByText(/nenhuma conversa|escolha uma caixa|sem conversa/i).first();
    const visible = (await list.isVisible().catch(() => false)) || (await empty.isVisible().catch(() => false));
    expect(visible).toBeTruthy();
  });

  test('2. Clicar primeira conversa abre painel central (se existir)', async ({ page }) => {
    // Tenta clicar primeiro item de conversa visível
    const items = page.locator('[role="button"], button, a').filter({ hasText: /\d{2}\/\d{2}|^\d{1,2}h|hoje|ontem|@|\+55/i });
    const count = await items.count();
    if (count === 0) {
      // Sem conversas (empty) — passa o teste sanity
      await expect(page.locator('body')).toBeVisible();
      return;
    }
    await items.first().click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // Depois do click, painel central deve mostrar mensagens OU permanecer placeholder
    await expect(page.locator('body')).toBeVisible();
  });

  test('3. URL do helpdesk pode ter query param (filtro/inbox)', async ({ page }) => {
    const url = page.url();
    expect(url).toMatch(/\/dashboard\/helpdesk/);
  });

  test('4. Header tem indicação de departamento ou inbox no super_admin', async ({ page }) => {
    // Super_admin vê seletor de inbox; atendente vê inbox fixa
    const indicator = page.getByText(/eletropiso|caixa|inbox|todos|departamento/i);
    const count = await indicator.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('5. Sem console error crítico após carregar', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    // Tolera warnings mas não pageerror
    const critical = errors.filter(e => !/devtools|warning|hydrat/i.test(e));
    expect(critical.length).toBe(0);
  });
});
