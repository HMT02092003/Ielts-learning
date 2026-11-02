import { expect, test, type Page } from '@playwright/test';
import { backendEnv } from './backend-env';

const env = backendEnv();
const ADMIN = { email: env.SEED_ADMIN_EMAIL ?? '', password: env.SEED_ADMIN_PASSWORD ?? '' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function paste(page: Page, button: string, text: string) {
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(text);
  await dialog.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(dialog).toBeHidden();
}

test('builder: writing-only test → create draft → publish', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await login(page);
  await page.goto('/admin/tests');
  await page.getByRole('link', { name: 'Soạn đề mới' }).click();
  await expect(page).toHaveURL(/\/admin\/tests\/new$/);

  await page.getByLabel('Tên đề').fill('Builder Writing E2E');
  await expect(page.getByLabel('Mã series')).toHaveValue('builder-writing-e2e');
  await page.getByRole('button', { name: 'Thêm Writing' }).click();

  // Task 1 (Academic report) is selected
  await page.getByRole('button', { name: 'Báo cáo biểu đồ (AC)' }).click();
  await expect(page.getByLabel('Đề bài')).toHaveValue(/Summarise the information/);

  const outline = page.getByRole('navigation', { name: 'Dàn ý đề' });
  await outline.getByRole('button', { name: /Task 2/ }).click();
  await page.getByRole('button', { name: 'Discuss both views' }).click();
  await expect(page.getByLabel('Đề bài')).toHaveValue(/Discuss both these views/);

  await expect(page.getByRole('button', { name: /Đủ điều kiện xuất bản · chưa lưu/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await expect(page).toHaveURL(/\/admin\/tests\/[0-9a-f-]{36}\/builder$/);
  await expect(page.getByText('Đủ điều kiện xuất bản')).toBeVisible();

  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/tests\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Đã xuất bản', { exact: true }).first()).toBeVisible();
});

test('builder: reading passage + TFNG group with paste helpers, numbering, preview, local draft', async ({
  page,
}) => {
  page.on('dialog', (d) => void d.accept());
  await login(page);
  await page.goto('/admin/tests/new');
  await page.getByLabel('Tên đề').fill('Builder Reading E2E');
  await page.getByRole('button', { name: 'Thêm Reading' }).click();

  // Passage 1: paste the whole text
  await page.getByLabel('Tiêu đề bài đọc').fill('Urban Bees');
  await paste(
    page,
    'Dán cả bài',
    'A  Bees have lived in cities\nfor a long time.\n\nB  Rooftop hives became popular in 2010.\n\nC  Some residents worry about stings.',
  );
  await expect(page.getByLabel('Nhãn đoạn 1')).toHaveValue('A');
  await expect(page.getByLabel('Nhãn đoạn 3')).toHaveValue('C');
  await expect(page.getByLabel('Nội dung đoạn A')).toHaveValue('Bees have lived in cities for a long time.');

  // TFNG group: paste statements and the answer key
  const outline = page.getByRole('navigation', { name: 'Dàn ý đề' });
  await outline.getByRole('button', { name: /Q1–3 · True\/False\/NG/ }).click();
  await paste(
    page,
    'Dán các nhận định',
    '1 Bees are new to cities.\n2 Rooftop hives were popular in 2010.\n3 Stings are rare.\n4 Honey is sold locally.',
  );
  await expect(outline.getByRole('button', { name: /Q1–4 · True\/False\/NG/ })).toBeVisible();
  // numbering continues in passage 2
  await expect(outline.getByRole('button', { name: /Q5–7/ })).toBeVisible();

  await paste(page, 'Dán đáp án', '1 F 2 T 3 NG 4 NG');
  await expect(page.getByText('Đã điền 4 đáp án')).toBeVisible();
  await expect(
    page.getByRole('radiogroup', { name: 'Đáp án câu 2' }).getByRole('radio', { name: 'TRUE' }),
  ).toHaveAttribute('aria-checked', 'true');

  // preview renders the student view
  await expect(page.getByRole('region', { name: 'Questions 1–4' })).toBeVisible();

  // switch the type: MCQ starter replaces the questions
  await page.getByLabel('Dạng câu hỏi').selectOption('MATCHING_INFORMATION');
  await expect(page.getByRole('button', { name: /Lấy nhãn từ bài đọc \(A, B, C\)/ })).toBeVisible();

  // unsaved work survives a reload
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByText('Có bản đang soạn dở chưa lưu')).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Builder Reading E2E' })).toBeVisible();
});

test('builder: an unfinished test is saved on the server and comes back after reload', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await login(page);
  await page.goto('/admin/tests/new');
  await page.getByLabel('Tên đề').fill('Builder WIP E2E');
  await page.getByRole('button', { name: 'Thêm Reading' }).click();
  await page.getByLabel('Tiêu đề bài đọc').fill('Half-written passage');

  await expect(page.getByRole('button', { name: /mục chưa xong · lưu được dạng bản soạn dở/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await expect(page).toHaveURL(/\/admin\/tests\/[0-9a-f-]{36}\/builder$/);
  await expect(page.getByText(/Đã lưu bản soạn dở — còn \d+ mục chưa xong/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('Có bản đang soạn dở chưa lưu')).toBeHidden();
  await expect(page.getByText('đã lưu bản soạn dở (chưa áp dụng vào đề)')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Dàn ý đề' })
    .getByRole('button', { name: /Passage 1/ })
    .click();
  await expect(page.getByLabel('Tiêu đề bài đọc')).toHaveValue('Half-written passage');
  await expect(page.getByRole('button', { name: 'Xuất bản', exact: true })).toBeDisabled();

  await page.goto('/admin/tests');
  await page.getByRole('radio', { name: 'Danh sách' }).click();
  const row = page.getByRole('row', { name: /Builder WIP E2E/ });
  await expect(row.getByText('Đang soạn')).toBeVisible();
});
