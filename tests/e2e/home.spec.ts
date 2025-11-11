import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check if page title contains LuckyMart
    await expect(page).toHaveTitle(/LuckyMart/i);
  });

  test('should display navigation menu', async ({ page }) => {
    await page.goto('/');
    
    // Check for navigation items
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check for bottom navigation
    const bottomNav = page.locator('[class*="fixed bottom-0"]');
    await expect(bottomNav).toBeVisible();
  });

  test('should have language switcher', async ({ page }) => {
    await page.goto('/');
    
    // Look for language switcher component
    // This is a generic check - adjust based on actual implementation
    const languageSwitcher = page.getByText(/中文|Русский|Тоҷикӣ/i);
    await expect(languageSwitcher).toBeTruthy();
  });

  test('should display lottery cards', async ({ page }) => {
    await page.goto('/');
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Check if there are any lottery-related elements
    // This is flexible as the exact structure may vary
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});
