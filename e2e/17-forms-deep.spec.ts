import { test, expect } from '@playwright/test';

test.describe('Onda 3E — Forms editor (5 testes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/forms');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('1. Página /forms renderiza sem erro', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard\/forms/);
    await expect(page.locator('text=/algo deu errado|crashed/i')).toHaveCount(0);
    const indicator = page.getByText(/formulário|formulario|form|criar|novo|template|wizard/i);
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. Botão "Novo Formulário"/"Criar" presente', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /novo|criar|nova|adicionar|template|wizard/i });
    const count = await newBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3. Lista de forms ou empty state visível (Eletropiso migrou 6 forms)', async ({ page }) => {
    const indicator = page.locator('table, [role="table"], article, li').or(
      page.getByText(/nenhum formulário|sem forms|crie|empty/i)
    );
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 });
  });

  test('4. Sem erro 401/403 (RLS forms OK)', async ({ page }) => {
    await expect(page.locator('text=/permission denied|unauthorized|sem acesso/i')).toHaveCount(0);
  });

  test('5. Sidebar Atendimento visível e logado', async ({ page }) => {
    // Sanity check: sessão ativa
    const sidebar = page.getByText(/^Atendimento$/i).first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });
});
