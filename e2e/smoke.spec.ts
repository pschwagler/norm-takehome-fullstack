import { test, expect, Page } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

// --- Mock data for route interception ---

const mockLegislation = [
  {
    id: 1,
    name: 'Laws of the Seven Kingdoms',
    file_name: 'laws.pdf',
    jurisdiction: 'Kingdom-wide',
    laws_count: 31,
    uploaded_at: '2026-03-01T00:00:00',
    uploaded_by: null,
  },
];

const mockThreads = [
  {
    id: 1,
    title: 'What about trade laws?',
    jurisdiction: 'Kingdom-wide',
    message_count: 2,
    created_at: '2026-03-01T12:00:00',
  },
];

const mockLawGroups = [
  {
    topic: 'Peace & Diplomacy',
    laws: [
      {
        id: 1,
        section: '1.1',
        topic: 'Peace & Diplomacy',
        section_title: 'Maintaining the Peace',
        text: 'All lords shall keep the peace within their domains.',
        jurisdiction: 'Kingdom-wide',
        legislation_id: 1,
      },
    ],
  },
];

/**
 * Intercept frontend API calls so tests don't depend on backend availability.
 * The frontend hits NEXT_PUBLIC_API_URL (port 80 in .env).
 * Only intercept XHR/fetch requests, not page navigations.
 */
async function mockApiRoutes(page: Page): Promise<void> {
  await page.route('**/threads', (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: mockThreads });
    }
    return route.continue();
  });

  await page.route('**/legislation', (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: mockLegislation });
    }
    return route.continue();
  });

  await page.route('**/laws?*', (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    return route.fulfill({ json: mockLawGroups });
  });

  await page.route('**/laws', (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: mockLawGroups });
    }
    return route.continue();
  });

  await page.route('**/health', (route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    return route.fulfill({
      json: { status: 'ok', legislation_loaded: 1, laws_indexed: 31 },
    });
  });
}

// --- Home page ---

test.describe('Home page', () => {
  test('loads and shows the heading and query input', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    await expect(
      page.getByText('Westeros Legal Compliance')
    ).toBeVisible();

    await expect(
      page.getByPlaceholder('Enter your question...')
    ).toBeVisible();
  });

  test('shows header nav with brand name', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    await expect(
      page.getByText('Westeros Capital Group')
    ).toBeVisible();
  });

  test('shows conversation sidebar with toggle', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    await expect(page.getByLabel('Toggle sidebar')).toBeVisible();
    await expect(page.getByLabel('New Conversation')).toBeVisible();
  });

  test('submit button is disabled when input is empty', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const submitButton = page.getByLabel('Ask');
    await expect(submitButton).toBeDisabled();
  });

  test('submit button becomes enabled when text is entered', async ({
    page,
  }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const input = page.getByPlaceholder('Enter your question...');
    await input.fill('What are the laws about trade?');

    const submitButton = page.getByLabel('Ask');
    await expect(submitButton).toBeEnabled();
  });
});

// --- Legislation page ---

test.describe('Legislation page', () => {
  test('loads and shows the upload drop zone', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/legislation');

    await expect(
      page.getByText('Drag and drop a PDF here, or click to browse')
    ).toBeVisible();
  });

  test('shows legislation list from API', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/legislation');

    await expect(
      page.getByText('Laws of the Seven Kingdoms')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking legislation loads its laws', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/legislation');

    const card = page.getByText('Laws of the Seven Kingdoms');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    // Law topic should appear after clicking
    await expect(
      page.getByText('Peace & Diplomacy')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navigates from home to legislation via nav link', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    await page.locator('a[href="/legislation"]').click();
    await page.waitForURL('/legislation');

    await expect(page).toHaveURL(/\/legislation/);
  });
});

// --- Navigation ---

test.describe('Navigation', () => {
  test('navigates between pages', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
    await expect(page).toHaveURL('/');

    await page.locator('a[href="/legislation"]').click();
    await page.waitForURL('/legislation');
    await expect(page).toHaveURL(/\/legislation/);

    await page.locator('a[href="/"]').first().click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });
});

// --- Conversation sidebar ---

test.describe('Conversation sidebar', () => {
  test('toggle expands and collapses the sidebar', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const toggle = page.getByLabel('Toggle sidebar');
    await expect(toggle).toBeVisible();

    // Expand
    await toggle.click();

    // Should show thread title when expanded
    await expect(page.getByText('What about trade laws?')).toBeVisible({
      timeout: 5_000,
    });

    // Collapse
    await toggle.click();

    // Thread title should be hidden when collapsed
    await expect(page.getByText('What about trade laws?')).not.toBeVisible();
  });

  test('new conversation button is visible when collapsed and below the toggle', async ({
    page,
  }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const toggle = page.getByLabel('Toggle sidebar');
    const newBtn = page.getByLabel('New Conversation');

    // Both visible when collapsed
    await expect(toggle).toBeVisible();
    await expect(newBtn).toBeVisible();

    // New Conversation button is below the toggle (higher top offset)
    const toggleBox = await toggle.boundingBox();
    const newBtnBox = await newBtn.boundingBox();
    expect(toggleBox).toBeTruthy();
    expect(newBtnBox).toBeTruthy();
    expect(newBtnBox!.y).toBeGreaterThan(toggleBox!.y);

    // Expand — still visible and still below
    await toggle.click();
    await expect(newBtn).toBeVisible();
    const toggleBoxExpanded = await toggle.boundingBox();
    const newBtnBoxExpanded = await newBtn.boundingBox();
    expect(newBtnBoxExpanded!.y).toBeGreaterThan(toggleBoxExpanded!.y);

    // Collapse — still visible
    await toggle.click();
    await expect(newBtn).toBeVisible();
  });

  test('new conversation button resets the view', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');

    const newBtn = page.getByLabel('New Conversation');
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Should still show the empty state heading
    await expect(
      page.getByText('Westeros Legal Compliance')
    ).toBeVisible();
  });
});

// --- API health (direct backend calls, no browser page needed) ---

test.describe('API health', () => {
  test('backend health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.legislation_loaded).toBeGreaterThanOrEqual(1);
    expect(body.laws_indexed).toBeGreaterThan(0);
  });

  test('backend laws endpoint returns grouped laws', async ({ request }) => {
    const response = await request.get(`${API_BASE}/laws`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('topic');
    expect(body[0]).toHaveProperty('laws');
  });

  test('backend legislation endpoint returns seeded legislation', async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/legislation`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('laws_count');
  });

  test('backend threads endpoint returns list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/threads`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
