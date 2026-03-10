import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows the heading and query input', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByText('Westeros Legal Compliance')
    ).toBeVisible();

    await expect(
      page.getByPlaceholder('Enter your question...')
    ).toBeVisible();
  });

  test('shows header nav with brand name and navigation links', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByText('Westeros Capital Group')
    ).toBeVisible();

    // Home and Documents nav buttons (rendered as unstyled buttons with tooltips)
    const navButtons = page.locator('header button, nav button, [class*="chakra"] button').filter({ has: page.locator('svg') });
    // At minimum, the user avatar menu button and 2 nav buttons exist
    await expect(navButtons.first()).toBeVisible();
  });

  test('shows conversation sidebar with toggle', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Toggle sidebar')).toBeVisible();
    await expect(page.getByLabel('New Conversation')).toBeVisible();
  });

  test('submit button is disabled when input is empty', async ({ page }) => {
    await page.goto('/');

    const submitButton = page.getByLabel('Ask');
    await expect(submitButton).toBeDisabled();
  });

  test('submit button becomes enabled when text is entered', async ({
    page,
  }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Enter your question...');
    await input.fill('What are the laws about trade?');

    const submitButton = page.getByLabel('Ask');
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('Documents page', () => {
  test('loads and shows the upload drop zone', async ({ page }) => {
    await page.goto('/documents');

    // Should show some form of upload UI
    await expect(page.getByText('Upload', { exact: false })).toBeVisible();
  });

  test('navigates from home to documents via nav link', async ({ page }) => {
    await page.goto('/');

    await page.locator('a[href="/documents"]').click();
    await page.waitForURL('/documents');

    await expect(page).toHaveURL('/documents');
  });
});

test.describe('Navigation', () => {
  test('navigates between pages', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');

    await page.locator('a[href="/documents"]').click();
    await page.waitForURL('/documents');
    await expect(page).toHaveURL('/documents');

    await page.locator('a[href="/"]').first().click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });
});

test.describe('API health', () => {
  test('backend health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:80/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.documents_loaded).toBeGreaterThanOrEqual(1);
    expect(body.laws_indexed).toBeGreaterThan(0);
  });

  test('backend laws endpoint returns grouped laws', async ({ request }) => {
    const response = await request.get('http://localhost:80/laws');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('topic');
    expect(body[0]).toHaveProperty('laws');
  });

  test('backend documents endpoint returns seeded document', async ({
    request,
  }) => {
    const response = await request.get('http://localhost:80/documents');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('laws_count');
  });
});
