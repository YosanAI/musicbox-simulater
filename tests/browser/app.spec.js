import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const sample = name => fileURLToPath(new URL(`../../public/samples/${name}`, import.meta.url));

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__CRESCENDO__?.getDiagnostics().ready);
  await expect(page.locator('#loading')).toHaveClass(/done/);
}
async function setRange(page, id, value) {
  await page.locator(`#${id}`).evaluate((element, next) => {
    element.value = String(next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('boots with real Three.js scene objects and no graphics or console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await ready(page);
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const app = window.__CRESCENDO__;
    return {
      ...app.getDiagnostics(),
      realScene: app.scene.renderer.scene.isScene,
      realCamera: app.scene.renderer.camera.isPerspectiveCamera,
      meshCount: app.scene.renderer.scene.children.filter(node => node.isMesh).length,
    };
  });
  expect(result.renderer).toBe('Three.js');
  expect(result.revision).toBe('180');
  expect(result.realScene).toBe(true);
  expect(result.realCamera).toBe(true);
  expect(result.teeth).toBe(72);
  expect(result.pins).toBe(219);
  expect(result.meshCount).toBeGreaterThan(90);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
});

test('plays, pauses, changes speed and rewinds using the audio clock', async ({ page }) => {
  await ready(page);
  await page.locator('#playBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.sound.startedNotes)).toBeGreaterThan(0);
  await expect(page.locator('#playBtn')).toHaveAttribute('aria-label', 'Pause');
  await page.locator('#playBtn').click();
  await expect(page.locator('#playStatus')).toHaveText('PAUSED');
  await setRange(page, 'speed', 1.5);
  await expect(page.locator('#speedOut')).toHaveText('1.50×');
  await page.locator('#resetBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.transport.position())).toBe(0);
});

test('swaps cylinders and gates playback while lifted', async ({ page }) => {
  await ready(page);
  await page.locator('.cylinder-card').nth(1).click();
  await expect(page.locator('#nowTitle')).toHaveText('Für Elise');
  await expect(page.locator('#playBtn')).toBeEnabled();
  await page.locator('#ejectBtn').click();
  await expect(page.locator('#playBtn')).toBeDisabled();
  await expect(page.locator('#playStatus')).toHaveText('CYLINDER LIFTED');
  await page.locator('#ejectBtn').click();
  await expect(page.locator('#playBtn')).toBeEnabled();
});

test('imports the original GLB and JSON samples', async ({ page }) => {
  await ready(page);
  await page.locator('#fileInput').setInputFiles(sample('Four-note-test.glb'));
  await expect(page.locator('#nowTitle')).toHaveText('Four-note test cylinder');
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(4);
  await expect(page.locator('#sourceBadge')).toHaveText('READ FROM 3D PIN GEOMETRY');
  await page.locator('#fileInput').setInputFiles(sample('Canon-in-D.json'));
  await expect(page.locator('#nowTitle')).toHaveText('Canon in D');
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(219);
});

test('creates a cylinder in the editor and exports a playable GLB', async ({ page }) => {
  await ready(page);
  await page.locator('#workshopBtn').click();
  await page.locator('#clearEditor').click();
  await page.locator('#editTitle').fill('Editor regression');
  await page.locator('#editorCanvas').evaluate(canvas => {
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: bounds.left + 58 + 32 * 13 + 4,
      clientY: bounds.top + 27 + (71 - 24) * 18 + 9,
      bubbles: true,
    }));
  });
  await expect(page.locator('#editPinCount')).toHaveText('1 pins');
  await page.locator('#applyEditor').click();
  await expect(page.locator('#nowTitle')).toHaveText('Editor regression');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Editor-regression.glb');
  const bytesPath = await download.path();
  await page.locator('#fileInput').setInputFiles({
    name: 'Editor-regression.glb', mimeType: 'model/gltf-binary',
    buffer: await (await import('node:fs/promises')).readFile(bytesPath),
  });
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(1);
});

test('view controls, labels and case visibility remain independent of the score', async ({ page }) => {
  await ready(page);
  await page.locator('[data-view="top"]').click();
  await expect(page.locator('[data-view="top"]')).toHaveClass(/active/);
  await page.locator('#labelsBtn').click();
  await expect(page.locator('#labels')).toBeVisible();
  await page.getByText('Walnut case & lid', { exact: true }).click();
  expect(await page.evaluate(() => window.__CRESCENDO__.scene.caseParts.every(part => !part.visible))).toBe(true);
  expect(await page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(219);
});

test('renders a stereo WAV and reports invalid local files', async ({ page }) => {
  await ready(page);
  await page.locator('#fileInput').setInputFiles(sample('Four-note-test.json'));
  await expect(page.locator('#nowTitle')).toHaveText('Four-note test cylinder');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#wavBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.wav$/);
  const bytes = await (await import('node:fs/promises')).readFile(await download.path());
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  expect(bytes.readUInt16LE(22)).toBe(2);
  await page.locator('#fileInput').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"notes":null}'),
  });
  await expect(page.locator('#toast')).toHaveClass(/error/);
  await expect(page.locator('#playBtn')).toBeEnabled();
});

test('dispose releases the audio context, meshes and global debug reference', async ({ page }) => {
  await ready(page);
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => window.__CRESCENDO__.transport.running);
  const result = await page.evaluate(async () => {
    const { app, scene, sound, transport } = window.__CRESCENDO__;
    app.dispose();
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      disposed: app.disposed,
      timer: transport.timer,
      parts: scene.renderer.nodes.length,
      context: sound.context.state,
      reference: Boolean(window.__CRESCENDO__),
    };
  });
  expect(result).toEqual({ disposed: true, timer: null, parts: 0, context: 'closed', reference: false });
});
