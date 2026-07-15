import { test, expect } from '@playwright/test';

test.describe('Student RBAC restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'student@runstart.test');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/courses', { timeout: 15_000 });
  });

  test('student cannot create a course via /courses/new', async ({ page }) => {
    await page.goto('/courses/new');
    await page.fill('#title', 'Student Hack Course');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/courses/new') && res.request().method() === 'POST',
      ),
      page.click('button:has-text("Создать")'),
    ]);

    expect(response.status()).toBe(500);
    await expect(page).not.toHaveURL(/\/courses\/[^/]+\/edit/);

    await page.goto('/courses');
    await expect(page.locator('text=Student Hack Course')).toHaveCount(0);
  });

  test('student cannot save changes on an existing course settings page', async ({ page }) => {
    await page.goto('/courses');
    await page.click('a[href*="/edit/settings"]');
    await page.waitForURL('**/edit/settings');

    await page.click('button:has-text("Сохранить")');

    await expect(page.locator('text=Teacher role required')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/edit\/settings/);
  });
});
