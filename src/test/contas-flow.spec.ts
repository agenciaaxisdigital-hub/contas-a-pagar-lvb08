import { test, expect } from '@playwright/test';

test.describe('Contas a Pagar routes', () => {
  test('/ route accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/nova-conta route accessible', async ({ page }) => {
    await page.goto('/nova-conta');
    await expect(page.locator('body')).toBeVisible();
    const url = page.url();
    const isValid = url.includes('/nova-conta') || url.includes('/login') || url.includes('/empresas');
    expect(isValid).toBe(true);
  });

  test('/empresas route shows company selector or redirects', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page.locator('body')).toBeVisible();
  });
});
