import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('signup creates school and first user, then redirects', async ({ page }) => {
    const ts = Date.now();
    await page.goto('/signup');

    await page.fill('#schoolName', `E2E School ${ts}`);
    await page.fill('#schoolSlug', `e2e-school-${ts}`);
    await page.fill('#adminName', 'E2E Admin');
    await page.fill('#email', `admin-${ts}@e2e.test`);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // After signup -> signIn -> redirect to /courses
    await page.waitForURL('**/courses', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/courses/);
  });

  test('login with valid credentials redirects to courses', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@school1.test');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/courses', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/courses/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@school1.test');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/error=/);
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#email', 'admin@school1.test');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/courses', { timeout: 15_000 });

    // Find and click logout
    await page.goto('/api/auth/signout');
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // Should be logged out — visiting /courses redirects to login
    await page.goto('/courses');
    await expect(page).toHaveURL(/\/login/);
  });
});
