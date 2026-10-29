import { expect, test, type Page } from '@playwright/test';
import { backendEnv } from './backend-env';

const env = backendEnv();
const STUDENT = { email: env.SEED_STUDENT_EMAIL ?? '', password: env.SEED_STUDENT_PASSWORD ?? '' };
const ADMIN = { email: env.SEED_ADMIN_EMAIL ?? '', password: env.SEED_ADMIN_PASSWORD ?? '' };

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('unauthenticated users are sent to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(STUDENT.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu không đúng' })).toBeVisible();
});

test('student: login → dashboard → theme → exam preview → logout', async ({ page }) => {
  await login(page, STUDENT);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào');

  // Dark mode applies to the Study shell…
  await page.getByRole('button', { name: 'Giao diện' }).click();
  await page.getByRole('menuitemradio', { name: 'Tối' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // …but the Exam shell stays light.
  await page.goto('/preview');
  const exam = page.locator('.exam-mode');
  await expect(exam).toBeVisible();
  const bg = await exam.evaluate((el) => getComputedStyle(el).getPropertyValue('--background').trim());
  expect(bg.toLowerCase()).toBe('#f4f6f8');
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('button', { name: /Câu 4, chưa trả lời, đã đánh dấu/ })).toHaveAttribute(
    'aria-current',
    'true',
  );

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Tài khoản' }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('timer turns critical under one minute', async ({ page }) => {
  await login(page, STUDENT);
  await page.goto('/preview?t=45');
  await expect(page.getByRole('timer')).toContainText('dưới 1 phút');
});

test('student cannot open /admin; admin can', async ({ page, context }) => {
  await login(page, STUDENT);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();

  await context.clearCookies();
  await login(page, ADMIN);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Quản trị' })).toBeVisible();
  await expect(page.getByText('Đã xuất bản')).toBeVisible();
});

test('a revoked session returns to /login without a redirect loop', async ({ page, context }) => {
  await login(page, STUDENT);
  // Simulate an expired access JWT + a refresh token that the server no longer accepts.
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(
    cookies.map((c) =>
      c.name.endsWith('ielts_at') || c.name.endsWith('ielts_rt') ? { ...c, value: 'revoked' } : c,
    ),
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});
