import { test, expect } from '@playwright/test';

test.describe('Onda 1B — Helpdesk (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/helpdesk');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. /dashboard/helpdesk carrega sem ErrorBoundary', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/helpdesk/);
    await expect(page.locator('text=/algo deu errado|error boundary|crashed/i')).toHaveCount(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('2. Tabs de escopo (Minhas/Não atribuídas/Todas) renderizam (visíveis ou hidden responsivo)', async ({ page }) => {
    // Spans tem versão visible/sm:hidden. Conta TODOS os matches (não exige visibilidade).
    const labels = page.getByText(/minhas|não atribuídas|nao atribuidas|^todas$/i);
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. Lista renderiza item, empty state, ou loading skeleton', async ({ page }) => {
    // Aceita: items reais, empty state, ou skeleton
    const indicator = page.locator(
      '[data-testid*="conversation"], .skeleton, [class*="skeleton"]'
    ).or(page.getByText(/nenhuma conversa|sem conversas|empty|inbox vazia|escolha uma caixa|selecione/i));
    await expect(indicator.first()).toBeVisible({ timeout: 15_000 });
  });

  test('4. Sidebar global "Atendimento" presente (link/botão)', async ({ page }) => {
    // Sidebar global tem button "Atendimento" — sempre presente quando logado em /dashboard/*
    const trigger = page.getByText(/^Atendimento$/i).first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
  });

  test('5. Página renderiza conteúdo (não white screen)', async ({ page }) => {
    // Confere que body tem conteúdo significativo
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length || 0).toBeGreaterThan(50);
  });
});
