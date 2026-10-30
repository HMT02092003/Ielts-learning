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

test('student: settings → dashboard countdown; vocabulary → flashcard session', async ({ page }) => {
  await login(page);

  await page.goto('/settings');
  await page.getByLabel('Band mục tiêu').selectOption('6.5');
  await page.getByLabel('Ngày thi').fill('2027-03-01');
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(page.getByText('Đã lưu cài đặt')).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.getByText(/ngày tới kỳ thi · mục tiêu 6.5/)).toBeVisible();
  await expect(page.getByText('Band theo kỹ năng')).toBeVisible();
  await expect(page.getByText('Chuỗi ngày học')).toBeVisible();

  await page.goto('/vocabulary');
  await page.getByRole('button', { name: 'Thêm từ' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Từ / cụm từ').fill('meticulous');
  await dialog.getByLabel('Nghĩa tiếng Việt').fill('tỉ mỉ');
  await dialog.getByRole('button', { name: 'Thêm từ' }).click();
  await expect(page.getByRole('button', { name: 'meticulous', exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Ôn thẻ \(1\)/ }).click();
  await expect(page.getByText('meticulous').first()).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('tỉ mỉ')).toBeVisible();
  await expect(page.getByRole('button', { name: /Được/ })).toContainText('1 ngày');
  await page.keyboard.press('3');
  await expect(page.getByRole('heading', { name: /Xong phiên ôn/ })).toBeVisible();
});
