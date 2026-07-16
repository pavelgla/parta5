import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const STUDENT_EMAIL = 'student@runstart.test';
const TEACHER_EMAIL = 'teacher@runstart.test';
const PASSWORD = 'password';

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/courses', { timeout: 15_000 });
}

async function openQuizLesson(page: Page) {
  await page.goto('/learn');
  await page.click('text=Начать обучение');
  await page.waitForURL('**/learn/**');
  await page.click('text=Польза бега для здоровья');
  await page.waitForURL('**/lessons/**');
  await expect(page.getByTestId('quiz-start-button')).toBeVisible({ timeout: 10_000 });
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId('quiz-save-state')).toHaveText('Сохранено', { timeout: 5_000 });
}

// Answers questions 1–4 identically (all correct), leaving the SHORTANSWER
// question (#5) to the caller so both attempts can share this setup.
async function answerFirstFourCorrectly(page: Page) {
  await page.getByTestId('quiz-start-button').click();

  await page.getByTestId('choice-b').check(); // техника: средняя постановка
  await waitSaved(page);
  await page.getByTestId('quiz-next-button').click();

  await page.getByTestId('choice-a').check(); // пульсовые зоны: разговорный темп
  await waitSaved(page);
  await page.getByTestId('quiz-next-button').click();

  await page.getByTestId('choice-a').check(); // экипировка: термобельё
  await page.getByTestId('choice-c').check(); // экипировка: перчатки
  await waitSaved(page);
  await page.getByTestId('quiz-next-button').click();

  await page.getByTestId('truefalse-true').click(); // разминка обязательна
  await waitSaved(page);
  await page.getByTestId('quiz-next-button').click();
}

async function submitQuiz(page: Page) {
  await page.getByTestId('quiz-submit-button').click();
  await page.getByTestId('quiz-confirm-submit-button').click();
}

test.describe('Quiz flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('student completes the quiz with a perfect score', async ({ page }) => {
    await loginAs(page, STUDENT_EMAIL);
    await openQuizLesson(page);

    await answerFirstFourCorrectly(page);

    await page.getByTestId('shortanswer-input').fill('10');
    await waitSaved(page);
    await submitQuiz(page);

    await expect(page.getByTestId('quiz-score')).toContainText('10 / 10', { timeout: 10_000 });
    await expect(page.getByTestId('quiz-passed')).toContainText('Тест пройден');
  });

  test('second attempt with one wrong answer scores 8/10 and flags it in the review', async ({
    page,
  }) => {
    await loginAs(page, STUDENT_EMAIL);
    await openQuizLesson(page);

    await answerFirstFourCorrectly(page);

    // "5" is not an accepted minimum warm-up duration — intentionally wrong.
    await page.getByTestId('shortanswer-input').fill('5');
    await waitSaved(page);
    await submitQuiz(page);

    await expect(page.getByTestId('quiz-score')).toContainText('8 / 10', { timeout: 10_000 });

    const reviews = page.locator('[data-testid^="question-review-"]');
    await expect(reviews).toHaveCount(5);
    const wrongReview = reviews.last();
    await expect(wrongReview).toHaveAttribute('data-correct', 'false');
    await expect(wrongReview.getByTestId('correctness-badge')).toContainText('Неверно');
  });

  test('teacher sees the best score in the gradebook and can export CSV', async ({ page }) => {
    await loginAs(page, TEACHER_EMAIL);

    await page.goto('/courses');
    const courseCard = page.locator('li', { hasText: 'Введение в бег для начинающих' });
    await courseCard.getByRole('link', { name: 'Редактировать' }).click();
    await page.waitForURL('**/courses/**/edit');

    await page.getByRole('link', { name: 'Журнал' }).click();
    await page.waitForURL('**/gradebook');

    const studentRow = page.locator('tr', { hasText: 'Артём Новиков' });
    await expect(studentRow).toBeVisible({ timeout: 10_000 });
    await expect(studentRow).toContainText('10/10');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Экспорт/ }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const content = fs.readFileSync(filePath as string, 'utf-8');
    expect(content).toContain('Артём Новиков');
  });
});
