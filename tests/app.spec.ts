import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
async function register(page: Page, name = '共创测试者') {
  await page.getByRole('button', { name: '登录 / 加入' }).click();
  await page.getByRole('button', { name: '创建一个账号' }).click();
  await page.getByLabel('怎么称呼你').fill(name);
  await page.getByLabel('邮箱', { exact: true }).fill(randomUUID() + '@example.com');
  await page.getByLabel('密码', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: '创建账号', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '账号菜单' })).toBeVisible();
}
test('discovery loads without broken images, search and categories work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.activity-card')).toHaveCount(5);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('有趣的');
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.getByRole('button', { name: '摄影影像', exact: true }).click();
  await expect(page.locator('.activity-card')).toHaveCount(1);
  await page.getByLabel('搜索活动').fill('卧室音乐');
  await page.getByLabel('搜索活动').press('Enter');
  await expect(page.locator('.activity-card')).toHaveCount(1);
  await expect(page.locator('.card-title')).toContainText('卧室音乐会');
  await page.getByLabel('搜索活动').fill('找不到的场次');
  await page.getByLabel('搜索活动').press('Enter');
  await expect(page.getByText('灵感还没在这里开场')).toBeVisible();
  expect(errors).toEqual([]);
});
test('register, reserve, persist after reload and cancel', async ({ page }) => {
  await page.goto('/');
  await register(page);
  await page.getByRole('button', { name: '预约', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '已预约', exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '已预约', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '活动通知' }).click();
  await expect(page.locator('.header-popover')).toContainText('卧室音乐会');
  await page.getByRole('button', { name: '活动通知' }).click();
  await page.getByRole('button', { name: '已预约', exact: true }).click();
  await expect(page.getByRole('button', { name: '已预约', exact: true })).toHaveCount(0);
});
test('join a circle, filter memberships and publish an original work', async ({ page }) => {
  await page.goto('/');
  await register(page, '作品创作者');
  await page.goto('/circles');
  await page.getByRole('button', { name: '加入圈子', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '已加入', exact: true })).toBeVisible();
  await page
    .locator('.tabs')
    .getByRole('button', { name: /已加入/ })
    .click();
  await expect(page.locator('.circle-card')).toHaveCount(1);
  await page.goto('/works');
  await page.getByRole('button', { name: '发布作品', exact: true }).click();
  await page.getByLabel('选择作品图片').setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await page.getByLabel('作品名称').fill('我的共创测试作品');
  await page.getByLabel('创作故事').fill('这份作品来自一次完整的创作体验。');
  await page.getByRole('checkbox').check();
  await page.getByRole('dialog').getByRole('button', { name: '发布作品', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '我的作品', exact: true }).click();
  await expect(page.locator('.work-card')).toHaveCount(1);
  await page.getByRole('button', { name: '喜欢 我的共创测试作品' }).click();
  await expect(page.locator('.like-button')).toContainText('1');
  await page.reload();
  await expect(page.getByText('我的共创测试作品', { exact: true })).toBeVisible();
});
test('live chat and voting persist across sessions', async ({ page, browser }) => {
  await page.goto('/');
  await register(page, '现场用户');
  await page.goto('/live/poster-lab');
  await expect(page.getByText('已连接', { exact: true })).toBeVisible();
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await viewer.goto('http://127.0.0.1:3103/live/poster-lab');
  await expect(viewer.getByText('已连接', { exact: true })).toBeVisible();
  await page.getByLabel('聊天消息').fill('大家好，这是一次实时共创！');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(viewer.locator('.chat-message')).toContainText('大家好，这是一次实时共创！');
  await page.getByRole('button', { name: /自然清新/ }).click();
  await expect(page.locator('.poll-options .selected')).toContainText('自然清新');
  await page.reload();
  await expect(page.locator('.poll-options .selected')).toContainText('自然清新');
  await expect(page.locator('.chat-message')).toContainText('大家好，这是一次实时共创！');
  await context.close();
});
test('creator publishes and server relays video with direct WebRTC disabled', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'RTCPeerConnection', {
      value: class {
        constructor() {
          throw new Error('Direct WebRTC intentionally blocked by test');
        }
      },
    });
  });
  await page.goto('/');
  await register(page, '开播测试者');
  await page.goto('/studio');
  await page.getByLabel('活动名称').fill('浏览器实时直播验证');
  await page.getByLabel('活动介绍').fill('一起验证完整的摄像头开播与跨浏览器实时观看流程。');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '创建直播间，进入开播页' }).click();
  await expect(page).toHaveURL(/\/live\/[a-z0-9-]+/);
  await expect(page.getByText('已连接', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开启摄像头，开始直播' }).click();
  await expect(page.getByRole('button', { name: '结束直播', exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, 'RTCPeerConnection', {
      value: class {
        constructor() {
          throw new Error('Direct WebRTC intentionally blocked by test');
        }
      },
    });
  });
  const viewer = await context.newPage();
  await viewer.goto(page.url());
  await expect(viewer.locator('video')).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => viewer.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(() => viewer.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime), {
      timeout: 20000,
    })
    .toBeGreaterThan(3);
  const lateViewer = await context.newPage();
  await lateViewer.goto(page.url());
  await expect
    .poll(() => lateViewer.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '结束直播', exact: true }).click();
  await expect(viewer.getByRole('heading', { name: '这场共创已结束' })).toBeVisible();
  await expect(viewer.locator('video')).toHaveCount(0);
  await context.close();
});
test('mobile routes have no horizontal overflow and navigation is usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/circles', '/works', '/calendar', '/studio', '/live/poster-lab']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.getByRole('link', { name: '发现现场', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/');
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
});
test('calendar filtering and unknown routes offer recovery', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.locator('.calendar-day')).toHaveCount(42);
  await page.getByRole('checkbox', { name: '只看我的预约' }).check();
  await expect(page.getByText('这一天，还是一张空白画布')).toBeVisible();
  await page.getByRole('button', { name: '下个月' }).click();
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await page.goto('/missing-page');
  await expect(page.getByText('你访问的页面不存在。')).toBeVisible();
  await page.getByRole('link', { name: '回到发现页' }).click();
  await expect(page.locator('.activity-card').first()).toBeVisible();
});
