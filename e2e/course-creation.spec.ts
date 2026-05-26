import { test, expect } from '@playwright/test';

test.describe('Course creation (teacher flow)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'teacher@school1.test');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/courses', { timeout: 15_000 });
  });

  test('create course, fill settings, add module and lesson, add blocks', async ({ page }) => {
    const ts = Date.now();
    const courseTitle = `E2E Test Course ${ts}`;

    // Create course
    await page.click('text=Создать курс');
    await page.waitForURL('**/courses/new');
    await page.fill('#title', courseTitle);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit', { timeout: 10_000 });

    const courseUrl = page.url();
    const courseId = courseUrl.match(/\/courses\/([^/]+)\/edit/)?.[1];
    expect(courseId).toBeTruthy();

    // Navigate to settings
    await page.goto(`/courses/${courseId}/edit/settings`);
    await page.waitForLoadState('networkidle');

    // Fill subject and grade
    await page.selectOption('select:near(:text("Предмет"))', { index: 1 });
    await page.selectOption('select:near(:text("Класс"))', '7');
    await page.fill('input[placeholder="Одна-две фразы о курсе"]', 'E2E test description');
    await page.click('button:has-text("Сохранить")');
    await expect(
      page.locator('text=Сохранено').or(page.locator('text=Настройки курса')),
    ).toBeVisible({
      timeout: 5_000,
    });

    // Go back to editor
    await page.goto(`/courses/${courseId}/edit`);
    await page.waitForLoadState('networkidle');

    // Add a module
    await page.click('text=+ Добавить модуль');
    const moduleInput = page.locator('input[placeholder="Название модуля"]');
    await moduleInput.waitFor({ timeout: 5_000 });
    await moduleInput.fill('Модуль E2E');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Модуль E2E')).toBeVisible({ timeout: 5_000 });

    // Add a lesson to the module
    await page.click('text=Добавить', { timeout: 5_000 });
    const lessonInput = page.locator('input[placeholder="Название урока"]');
    await lessonInput.waitFor({ timeout: 5_000 });
    await lessonInput.fill('Урок E2E');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Урок E2E')).toBeVisible({ timeout: 5_000 });

    // Open the lesson
    await page.click('text=Урок E2E');
    await page.waitForURL('**/lessons/**', { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Add a TEXT block
    await page.click('text=Добавить блок');
    await page.click('text=Текст');
    await expect(
      page.locator('[data-block-type="TEXT"]').or(page.locator('.block-editor .prose')),
    ).toBeVisible({
      timeout: 5_000,
    });

    // Add a CALLOUT block
    await page.click('text=Добавить блок');
    await page.click('text=Заметка');
    await expect(
      page.locator('[data-block-type="CALLOUT"]').or(page.locator('text=Заметка').last()),
    ).toBeVisible({
      timeout: 5_000,
    });

    // Cleanup: go back and delete course
    await page.goto(`/courses/${courseId}/edit`);
    await page.waitForLoadState('networkidle');

    page.once('dialog', (dialog) => dialog.accept());
    await page.click('text=Удалить курс');
    await page.waitForURL('**/courses', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/courses$/);
  });
});
