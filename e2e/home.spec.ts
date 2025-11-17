'''
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the main title and navigation', async ({ page }) => {
    await page.goto('/');

    // 页面标题在 App.tsx 中设置，这里检查主页内容

    // 检查欢迎横幅中的标题
    await expect(page.getByRole('heading', { name: /欢迎/ })).toBeVisible();

    // 检查钱包卡片是否存在
    await expect(page.getByText('我的钱包')).toBeVisible();

    // 检查热门夺宝标题
    await expect(page.getByRole('heading', { name: '热门夺宝' })).toBeVisible();
    
    // 检查是否有夺宝卡片（假设至少有一个）
    // 由于数据是模拟的，我们检查是否有文章元素存在
    await expect(page.getByRole('article').first()).toBeVisible();
  });

  test('should navigate to the lottery list page', async ({ page }) => {
    await page.goto('/');

    // 点击查看全部链接
    await page.getByRole('link', { name: '查看全部' }).click();

    // 检查是否跳转到夺宝列表页
    await expect(page).toHaveURL(/.*\/lottery/);
    // 检查页面是否包含一个主要标题，例如“夺宝”或“Lottery”
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});
'''
