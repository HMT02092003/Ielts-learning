import { expect, test, type Page } from '@playwright/test';
import { backendEnv } from './backend-env';

const env = backendEnv();
const ADMIN = { email: env.SEED_ADMIN_EMAIL ?? '', password: env.SEED_ADMIN_PASSWORD ?? '' };
const STUDENT = { email: env.SEED_STUDENT_EMAIL ?? '', password: env.SEED_STUDENT_PASSWORD ?? '' };
// The seeded tests are CUSTOM with no book number, so they form one set.
const SEED_SET = 'Tự soạn — đề lẻ';

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** The set card: the innermost block holding both the set heading and its tests table. */
function setCard(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: SEED_SET }) })
    .filter({ has: page.getByRole('table') })
    .last();
}

async function setCounts(page: Page) {
  const text = await setCard(page)
    .getByText(/đã xuất bản · \d+ nháp/)
    .textContent();
  const [, published, draft] = /(\d+) đã xuất bản · (\d+) nháp/.exec(text ?? '') ?? [];
  return { published: Number(published), draft: Number(draft) };
}

test('admin: set view → export set as zip → import the zip → new drafts', async ({ page }, testInfo) => {
  await login(page, ADMIN);
  await page.goto('/admin/tests');
  await expect(page.getByRole('heading', { name: SEED_SET })).toBeVisible();
  const before = await setCounts(page);

  const downloading = page.waitForEvent('download');
  await setCard(page).getByRole('link', { name: 'Xuất bộ (.zip)' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^BandUp-CUSTOM-none-\d{4}-\d{2}-\d{2}\.zip$/);
  const zipPath = testInfo.outputPath('set.zip');
  await download.saveAs(zipPath);

  await page.goto('/admin/tests/import');
  await page.locator('input[type=file]').setInputFiles(zipPath);
  await page.getByRole('button', { name: 'Nhập đề' }).click();
  const summary = page.getByText(/^(\d+)\/\1 đề hợp lệ$/);
  await expect(summary).toBeVisible();
  const imported = Number(/^(\d+)/.exec((await summary.textContent()) ?? '')?.[1]);
  expect(imported).toBeGreaterThan(0);

  await page.goto('/admin/tests');
  await expect(page.getByRole('heading', { name: SEED_SET })).toBeVisible();
  await expect
    .poll(() => setCounts(page))
    .toEqual({ published: before.published, draft: before.draft + imported });
});

test('student: practice by set → open the set → start Reading', async ({ page }) => {
  await login(page, STUDENT);
  await page.goto('/practice');
  const toggle = page.getByRole('button', { name: new RegExp(SEED_SET) });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();

  // .last(): in the set view each set is itself a list item around its tests' items.
  const card = page.getByRole('listitem').filter({ hasText: 'Đề mẫu Reading (dummy)' }).last();
  await card.getByRole('button', { name: 'Làm bài' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Luyện tập' }).click();
  await dialog.getByRole('button', { name: 'Vào bài' }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]+$/);
  await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
});
