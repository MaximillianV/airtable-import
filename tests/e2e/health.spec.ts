import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('backend health endpoint should be accessible', async ({ page, context }) => {
    // Create a new page with API access
    const apiPage = await context.newPage();
    
    // Test backend API health endpoint directly
    const response = await apiPage.request.get('http://localhost:3001/api/health');
    expect(response.ok()).toBeTruthy();
    
    const health = await response.json();
    expect(health).toHaveProperty('status', 'OK');
    expect(health).toHaveProperty('timestamp');
    
    await apiPage.close();
  });

  test('frontend should load successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should see the login page or app title
    await expect(page).toHaveTitle(/Airtable Import/);
    
    // Should not have any console errors on page load
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a moment for any async errors
    await page.waitForTimeout(2000);
    
    // Allow some React development warnings but no critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Warning:') && 
      !error.includes('React') &&
      !error.includes('development')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});