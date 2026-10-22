import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

// Use an installed Playwright runtime without adding a production dependency.
const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');

test('open player menus consume outside timeline gestures and preserve inside actions', async () => {
  const server = await createServer({ server: { port: 0 }, appType: 'custom' });
  server.middlewares.use('/menu-pointer-test', async (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(await server.transformIndexHtml('/menu-pointer-test', '<html><body><div id="root"></div><script type="module" src="/tests/menuPointer.fixture.tsx"></script></body></html>'));
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route('**/api/**', route => route.request().resourceType() === 'fetch' ? route.fulfill({ json: {} }) : route.continue());
    page.on('pageerror', error => process.stderr.write(`${error.stack}\n`));
    await page.route('https://example.test/**', route => route.fulfill({ body: '' }));
    await page.goto(`${server.resolvedUrls.local[0]}menu-pointer-test`);
    await page.locator('video').waitFor({ state: 'attached' });
    await page.locator('video').evaluate(video => video.dispatchEvent(new Event('loadedmetadata')));
    const timeline = page.getByRole('slider', { name: 'Seek' });
    const box = await timeline.boundingBox();
    assert.ok(box);
    const settings = page.getByRole('button', { name: 'Playback settings', exact: true });
    const subtitles = page.getByRole('button', { name: /Subtitles/ });
    for (const opener of [settings, subtitles]) {
      for (const drag of [false, true]) {
        await page.locator('video').evaluate(video => { video.currentTime = 10; });
        await opener.click();
        await page.locator('[role="dialog"][aria-modal="true"]').waitFor();
        const calls = await page.locator('video').evaluate(video => [video.dataset.playCalls, video.dataset.pauseCalls]);
        await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
        await page.mouse.down();
        if (drag) await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
        assert.equal(await page.locator('video').evaluate(video => video.currentTime), 10, 'dismissal must not seek');
        assert.deepEqual(await page.locator('video').evaluate(video => [video.dataset.playCalls, video.dataset.pauseCalls]), calls, 'dismissal must not toggle playback');
        assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(), 0);
        assert.equal(await opener.evaluate(el => el === document.activeElement), true);
      }
      await opener.click();
      // Clicking the opener consumes dismissal without immediately reopening.
      await opener.click();
      assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(), 0);
    }
    await settings.click();
    // A pointer sequence with no compatibility click must not eat keyboard input.
    await timeline.dispatchEvent('pointerdown', { pointerId: 7, bubbles: true });
    await timeline.dispatchEvent('pointerup', { pointerId: 7, bubbles: true });
    await page.keyboard.press('Enter');
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ timeout: 2000 });
    await page.getByRole('button', { name: '1.5x', exact: true }).click();
    assert.equal(await page.locator('video').evaluate(video => video.playbackRate), 1.5);
    await page.keyboard.press('Escape');
    assert.equal(await settings.evaluate(el => el === document.activeElement), true);
    // The guard must release: a fresh gesture scrubs normally.
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    assert.ok(Math.abs(await page.locator('video').evaluate(video => video.currentTime) - 60) < 1);
  } finally {
    await browser.close();
    await server.close();
  }
});
