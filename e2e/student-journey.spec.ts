import { test, expect } from '@playwright/test';

test.describe('Student learning journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'student@runstart.test');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/courses', { timeout: 15_000 });
  });

  test('student sees enrolled RunStart course on /learn', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.locator('text=Введение в бег для начинающих')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('student opens the course and sees modules and lessons', async ({ page }) => {
    await page.goto('/learn');
    await page.click('text=Начать обучение');
    await page.waitForURL('**/learn/**');

    await expect(page.locator('text=Модуль 1: Зачем бегать')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Польза бега для здоровья')).toBeVisible();
  });

  test('student opens a lesson and sees its content blocks', async ({ page }) => {
    await page.goto('/learn');
    await page.click('text=Начать обучение');
    await page.waitForURL('**/learn/**');

    await page.click('text=Польза бега для здоровья');
    await page.waitForURL('**/lessons/**');

    await expect(page.locator('text=Почему бег — лучший старт')).toBeVisible({ timeout: 5_000 });
  });

  test('unauthenticated user is redirected from /learn to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/learn');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('progress bar shows after visiting a lesson page', async ({ page }) => {
    await page.goto('/learn');
    await page.click('text=Начать обучение');
    await page.waitForURL('**/learn/**');
    const courseUrl = page.url();

    await page.click('text=Польза бега для здоровья');
    await page.waitForURL('**/lessons/**');
    await expect(page.locator('body')).not.toContainText('404');

    await page.goto(courseUrl);
    const progressTrack = page.locator('.h-2.rounded-full.bg-gray-100');
    await expect(progressTrack).toBeVisible({ timeout: 5_000 });
  });
});
