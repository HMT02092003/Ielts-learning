import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { backendEnv, BACKEND_DIR } from './backend-env';

const env = backendEnv();
const ADMIN = { email: env.SEED_ADMIN_EMAIL ?? '', password: env.SEED_ADMIN_PASSWORD ?? '' };
const READING_FIXTURE = path.join(BACKEND_DIR, 'prisma', 'seed', 'fixtures', 'dummy-reading.json');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('admin: create a student account', async ({ page }) => {
  await login(page);
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill('hoc.vien.moi@ielts.local');
  await dialog.getByLabel('Tên hiển thị').fill('Học viên mới');
  await dialog.getByLabel('Mật khẩu (tối thiểu 8 ký tự)').fill('123456789');
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByText('hoc.vien.moi@ielts.local')).toBeVisible();
});

test('admin: import JSON (dry run, then import) → open test → publish', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(READING_FIXTURE);
  await page.getByRole('button', { name: 'Kiểm tra trước' }).click();
  await expect(page.getByText('File hợp lệ')).toBeVisible();
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  await page.getByRole('link', { name: 'Mở đề' }).click();

  await expect(page.getByText('Đủ điều kiện xuất bản')).toBeVisible();
  await page.getByText('Sửa JSON nâng cao').click();
  await expect(page.getByLabel('Nội dung (JSON)')).toHaveValue(/"seriesKey": "dummy-reading-ac"/);
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã xuất bản').first()).toBeVisible();
});

test('admin: answer editor edits the draft doc', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(READING_FIXTURE);
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  await page.getByRole('link', { name: 'Mở đề' }).click();

  await expect(page.getByRole('heading', { name: 'Rooftop Beekeeping in Northbridge' })).toBeVisible();
  await page.getByRole('button', { name: 'Câu 1: TRUE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Câu 1: TRUE', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Lưu đáp án' }).click();
  await expect(page.getByText('Đã lưu').first()).toBeVisible();

  await page.reload();
  await page.getByText('Sửa JSON nâng cao').click();
  await expect(page.getByLabel('Nội dung (JSON)')).toHaveValue(/"number": 1,[\s\S]*?"answer": "TRUE"/);
});

test('admin: JSON editor shows path-precise errors', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests');
  await page
    .getByRole('button', { name: 'Nhập JSON / .zip' })
    .or(page.getByRole('link', { name: 'Nhập JSON / .zip' }))
    .click();
  const bad = Buffer.from(
    JSON.stringify({ schemaVersion: 1, seriesKey: 'x', source: 'CAM', type: 'ACADEMIC', title: '' }),
  );
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: bad });
  await page.getByRole('button', { name: 'Kiểm tra trước' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'seriesKey' })).toBeVisible();
});

test('admin: answer editor shows option text and survives untrimmed variants in JSON', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(READING_FIXTURE);
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  await page.getByRole('link', { name: 'Mở đề' }).click();

  await page.getByRole('button', { name: 'Reading 2' }).click();
  await expect(page.getByText('ii — Measuring a lost object from an old image').first()).toBeVisible();

  await page.getByText('Sửa JSON nâng cao').click();
  const json = page.getByLabel('Nội dung (JSON)');
  const doc = (await json.inputValue()).replace('"harbor district"', '" harbor district", ""');
  await json.fill(doc);
  await page.getByRole('button', { name: 'Reading 1' }).click();
  await expect(page.getByLabel('Đáp án chấp nhận (mỗi dòng một biến thể) 6')).toHaveValue(
    /\n harbor district\n$/,
  );
});

test('admin: answer editor guards MC multi, flags empty answers, names groups', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(READING_FIXTURE);
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  await page.getByRole('link', { name: 'Mở đề' }).click();

  await expect(page.getByRole('group', { name: 'Câu 1', exact: true })).toBeVisible();
  await page.getByLabel('Đáp án đúng 6').fill('');
  await expect(page.getByText('Chưa có đáp án')).toBeVisible();

  await page.getByRole('button', { name: 'Reading 2' }).click();
  await expect(page.getByText('Đã chọn 2/2')).toBeVisible();
  const b = page.getByRole('button', { name: 'Câu 25–26: B', exact: true });
  await expect(b).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Câu 25–26: A', exact: true }).click();
  await expect(page.getByText('Đã chọn 1/2')).toBeVisible();
  await expect(b).not.toHaveAttribute('aria-disabled', 'true');
});

test('admin: hotfix on a published test updates the JSON view', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(READING_FIXTURE);
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  await page.getByRole('link', { name: 'Mở đề' }).click();
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã xuất bản').first()).toBeVisible();
  await page.reload();

  await page.getByLabel('Giải thích 2', { exact: true }).fill('Hotfix explanation 2');
  await page.getByRole('button', { name: 'Lưu câu 2', exact: true }).click();
  await expect(page.getByText('Đã lưu').first()).toBeVisible();
  await page.getByText('Sửa JSON nâng cao').click();
  await expect(page.getByLabel('Nội dung (JSON)')).toHaveValue(/Hotfix explanation 2/);
});
