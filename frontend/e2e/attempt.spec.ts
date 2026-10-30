import { expect, test, type Page } from '@playwright/test';
import { backendEnv } from './backend-env';

const env = backendEnv();
const STUDENT = { email: env.SEED_STUDENT_EMAIL ?? '', password: env.SEED_STUDENT_PASSWORD ?? '' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(STUDENT.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(STUDENT.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('student: practice library → Reading → answer + highlight → reload keeps both → submit → result', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Luyện đề' }).first().click();
  await expect(page).toHaveURL(/\/practice$/);

  const card = page.getByRole('listitem').filter({ hasText: 'Đề mẫu Reading (dummy)' });
  await card.getByRole('button', { name: 'Làm bài' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Luyện tập' }).click();
  await dialog.getByRole('button', { name: 'Vào bài' }).click();

  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]+$/);
  const attemptId = page.url().split('/').pop() ?? '';
  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  // Answer Q1 (TFNG).
  const q1 = page.locator('#q-1');
  await q1.getByText('FALSE', { exact: true }).click();
  await expect(q1.getByRole('radio', { name: 'FALSE' })).toBeChecked();

  // Highlight the first words of the first paragraph (selection → toolbar → "Tô sáng").
  await page.evaluate(() => {
    const p = document.querySelector('[data-anchor]');
    const text = p?.firstChild;
    if (!p || !text) throw new Error('no paragraph');
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 20);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Tô sáng' }).click();
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/v1/attempts/${attemptId}/annotations`);
      return ((await res.json()) as unknown[]).length;
    })
    .toBe(1);

  await expect(page.getByText(/Đã lưu · \d\d:\d\d/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.locator('#q-1').getByRole('radio', { name: 'FALSE' })).toBeChecked();

  // Submit (top bar → confirm dialog).
  await page.getByRole('button', { name: 'Nộp bài' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page).toHaveURL(new RegExp(`/results/${attemptId}$`));
  await expect(page.getByText(/^1\/40/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đáp án' })).toBeVisible();

  // Review screen shows the passage with the answers of part 1.
  await page.getByRole('link', { name: 'Xem lại bài' }).click();
  await expect(page.getByRole('heading', { name: 'Rooftop Beekeeping in Northbridge' })).toBeVisible();

  // History lists the attempt.
  await page.goto('/history');
  await expect(page.getByRole('link', { name: 'Xem kết quả' }).first()).toBeVisible();
});

test('student: Writing → type essay → submit → estimate with disclaimer', async ({ page }) => {
  await login(page);
  await page.goto('/practice');
  const card = page.getByRole('listitem').filter({ hasText: 'Đề mẫu Writing (dummy)' });
  await card.getByRole('button', { name: 'Làm bài' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Luyện tập' }).click();
  await dialog.getByRole('button', { name: 'Vào bài' }).click();
  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  await page.getByRole('button', { name: /^Task 2/ }).click();
  const essay =
    'Some people think that cities should close their centres to private cars. However, others argue that this would harm shops, which depend on drivers. In my opinion, the benefits are greater because the air becomes cleaner and the streets become safer for children. '.repeat(
      3,
    );
  await page.getByLabel('Bài viết Task 2').fill(essay);
  await expect(page.getByText(/từ · còn thiếu \d+ từ|đủ số từ tối thiểu/)).toBeVisible();
  await expect(page.getByText(/Đã lưu nháp/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Nộp bài' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page).toHaveURL(/\/results\//);
  await page.getByRole('tab', { name: 'Task 2' }).click();
  await expect(page.getByText('ƯỚC LƯỢNG, không thay thế giám khảo')).toBeVisible();
  await expect(page.getByText('Band ước lượng (chỉ 2 tiêu chí)')).toBeVisible({ timeout: 20_000 });

  // Admin grades Task 2 by hand; the student then sees the grader's band.
  const resultUrl = page.url();
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(env.SEED_ADMIN_EMAIL ?? '');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(env.SEED_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/admin/grading');
  await page
    .getByRole('button', { name: /Task 2/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Lưu điểm' }).click();
  await expect(page.getByText('Đã lưu điểm')).toBeVisible();

  await page.context().clearCookies();
  await login(page);
  await page.goto(resultUrl);
  await page.getByRole('tab', { name: 'Task 2' }).click();
  await expect(page.getByText(/Giám khảo chấm/)).toBeVisible();
});
