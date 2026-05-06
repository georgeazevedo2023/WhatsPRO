import { test as setup, expect } from '@playwright/test';

const STORAGE = 'e2e/.auth/admin.json';

setup('autenticar admin (super_admin)', async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD ausentes em .env.local');
  }

  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /^entrar/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.locator('body')).toBeVisible();

  await page.context().storageState({ path: STORAGE });
});
