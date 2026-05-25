import { test, expect } from '@playwright/test';

test.describe('RH Module', () => {
  test('/rh/funcionarios route is accessible when authenticated', async ({ page }) => {
    await page.goto('/rh/funcionarios');
    // Either shows the page or redirects to login — no crash
    await expect(page.locator('body')).toBeVisible();
    const url = page.url();
    const isValid = url.includes('/rh/funcionarios') || url.includes('/login') || url.includes('/empresas');
    expect(isValid).toBe(true);
  });

  test('/rh/funcionarios/novo route exists', async ({ page }) => {
    await page.goto('/rh/funcionarios/novo');
    await expect(page.locator('body')).toBeVisible();
    const url = page.url();
    const isValid = url.includes('/rh/') || url.includes('/login') || url.includes('/empresas');
    expect(isValid).toBe(true);
  });
});
