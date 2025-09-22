import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should be able to login with valid credentials', async ({ page, context }) => {
    await page.goto('/');
    
    // Should redirect to login page or show login form
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    
    // Fill in login form
    await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    
    // Submit login form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Should redirect to dashboard or main page after successful login
    await expect(page).toHaveURL(/\/(dashboard|home|app|$)/);
    
    // Should see some indication that we're logged in
    // This could be a user menu, logout button, or dashboard content
    await expect(
      page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="user-menu"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill in login form with invalid credentials
    await page.fill('input[type="email"], input[name="email"]', 'invalid@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    
    // Submit login form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Should show error message or stay on login page
    // Note: This test may need adjustment based on actual UI behavior
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
  });

  test('should be able to access protected routes after login', async ({ page, context }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    
    // Wait for successful login
    await expect(page).toHaveURL(/\/(dashboard|home|app|$)/);
    
    // Try to access settings page
    await page.goto('/settings');
    
    // Should not redirect back to login (i.e., we should stay on settings page)
    await expect(page).toHaveURL(/\/settings/);
    
    // Should see settings content
    await expect(
      page.locator('text=Settings, h1:has-text("Settings"), h2:has-text("Settings")')
    ).toBeVisible({ timeout: 5000 });
  });
});