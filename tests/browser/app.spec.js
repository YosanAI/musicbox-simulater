import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateCylinder, exportCylinderGLB } from '../../src/cylinder/index.js';

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
  expect(result.pins).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.__CRESCENDO__.transport.spec.turns)).toBe(3);
  await expect(page.locator('#nowTitle')).toContainText('Für Elise');
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
  await expect(page.locator('#nowTitle')).not.toContainText('Für Elise');
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

test('new sample files appear automatically, deduplicate pairs and play GLB-only cylinders', async ({ page }) => {
  await ready(page);
  const before = await page.locator('.cylinder-card').count();
  const directory = await mkdtemp(join(sample(''), 'library-test-'));
  const pair = validateCylinder({ title: 'Discovered JSON pair', duration: 8,
    notes: [{ midi: 60, time: 0.3 }, { midi: 64, time: 1 }] });
  const glb = validateCylinder({ title: 'Discovered GLB only', duration: 8,
    notes: [{ midi: 67, time: 0.3 }] });
  try {
    await Promise.all([
      writeFile(join(directory, 'pair.json'), JSON.stringify(pair)),
      writeFile(join(directory, 'pair.glb'), exportCylinderGLB(pair)),
      writeFile(join(directory, 'only.glb'), exportCylinderGLB(glb)),
      writeFile(join(directory, 'metadata.json'), JSON.stringify({ description: 'Not a cylinder' })),
    ]);
    await expect(page.locator('.cylinder-card')).toHaveCount(before + 2);
    const pairedCard = page.locator('.cylinder-card').filter({ hasText: pair.title });
    await expect(pairedCard).toHaveCount(1);
    await pairedCard.click();
    await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(2);
    const glbCard = page.locator('.cylinder-card').filter({ hasText: glb.title });
    await glbCard.click();
    await expect(page.locator('#nowTitle')).toHaveText(glb.title);
    await expect(page.locator('#sourceBadge')).toHaveText('READ FROM 3D PIN GEOMETRY');
    await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBe(1);
    await page.locator('#playBtn').click();
    await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.sound.startedNotes)).toBeGreaterThan(0);
    await page.locator('#playBtn').click();
    await rm(directory, { recursive: true, force: true });
    await expect(page.locator('.cylinder-card')).toHaveCount(before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
  expect(await page.evaluate(() => window.__CRESCENDO__.getDiagnostics().pins)).toBeGreaterThan(100);
});

test('case visibility cannot resize the scene or transport', async ({ page }) => {
  await ready(page);
  const measure = () => page.evaluate(() => ({
    scene: document.querySelector('.stage').getBoundingClientRect().height,
    footer: document.querySelector('.transport').getBoundingClientRect().height,
    canvas: document.querySelector('#sceneCanvas').getBoundingClientRect().height,
  }));
  const before = await measure();
  await page.getByText('Walnut case & lid', { exact: true }).click();
  await page.waitForTimeout(250);
  expect(await measure()).toEqual(before);
  await page.getByText('Walnut case & lid', { exact: true }).click();
  expect(await measure()).toEqual(before);
  expect(before.footer).toBe(153);
  expect(before.scene).toBe(847);
  expect(await page.locator('header').count()).toBe(0);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`toggles preserve layout with mouse and keyboard at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await page.locator('#settingsPanel').evaluate(element => { element.open = true; });
    const measure = () => page.evaluate(() => {
      const rect = selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      return { scene: rect('.stage'), footer: rect('.transport'), canvas: rect('#sceneCanvas'),
        pageScroll: scrollY, bodyHeight: document.body.scrollHeight };
    });
    for (const id of ['repeat', 'highlights', 'caseToggle', 'showResonance']) {
      const checkbox = page.locator(`#${id}`);
      const label = checkbox.locator('..');
      await label.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const before = await measure();
      const checked = await checkbox.isChecked();
      await label.click();
      await expect(checkbox).toBeChecked({ checked: !checked });
      expect(await measure(), `${id}: mouse`).toEqual(before);
      await checkbox.focus();
      expect(await measure(), `${id}: focus`).toEqual(before);
      await page.keyboard.press('Space');
      await expect(checkbox).toBeChecked({ checked });
      expect(await measure(), `${id}: keyboard`).toEqual(before);
    }
    if (viewport.width > 850) expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.locator('.sidebar #showResonance').count()).toBe(0);
    await expect(page.locator('.transport #showResonance')).toBeAttached();
    expect(await page.locator('.stage-heading .eyebrow').count()).toBe(0);
    expect(await page.locator('#workshopBtn').evaluate(element =>
      Boolean(element.compareDocumentPosition(document.querySelector('#library')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(await page.locator('#ejectBtn').evaluate(element =>
      Boolean(element.compareDocumentPosition(document.querySelector('#library')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    // The relocated option and all export actions fit inside the fixed footer.
    const footer = await page.locator('.transport').boundingBox();
    for (const selector of ['.playback-resonance', '#exportBtn', '#jsonBtn', '#wavBtn']) {
      const control = await page.locator(selector).boundingBox();
      expect(control.y).toBeGreaterThanOrEqual(footer.y);
      expect(control.y + control.height).toBeLessThanOrEqual(footer.y + footer.height);
    }
  });
}

test('exploded view creates a spring and removes it entirely when assembled', async ({ page }) => {
  await ready(page);
  const springCount = () => page.evaluate(() =>
    window.__CRESCENDO__.scene.renderer.nodes.filter(part => part.tag === 'mainspring').length);
  expect(await springCount()).toBe(0);
  await page.locator('#explodeBtn').click();
  await expect(page.locator('#explodeBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(springCount).toBeGreaterThan(0);
  await page.locator('#explodeBtn').click();
  await expect(page.locator('#explodeBtn')).toHaveAttribute('aria-pressed', 'false');
  expect(await springCount()).toBe(0);
  expect(await page.evaluate(() => window.__CRESCENDO__.scene.renderer.scene.children
    .some(node => node.name === 'mainspring'))).toBe(false);
});

test('panning moves the camera target and plucking works along the tooth', async ({ page }) => {
  await ready(page);
  const initial = await page.evaluate(() => [...window.__CRESCENDO__.scene.orbit.state.target]);
  const canvas = await page.locator('#sceneCanvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(canvas.x + canvas.width / 2 + 80, canvas.y + canvas.height / 2 + 30);
  await page.mouse.up({ button: 'right' });
  expect(await page.evaluate(() => window.__CRESCENDO__.scene.orbit.state.target)).not.toEqual(initial);
  await page.locator('[data-view="comb"]').click();
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.scene.orbit.animating)).toBe(false);
  const point = await page.evaluate(() => {
    const scene = window.__CRESCENDO__.scene;
    const tooth = scene.teeth[36];
    const m = tooth.node.matrix;
    const y = 0.00055;
    const z = -tooth.length * 0.35;
    const projected = scene.renderer.project([
      m[12] + m[4] * y + m[8] * z,
      m[13] + m[5] * y + m[9] * z,
      m[14] + m[6] * y + m[10] * z,
    ]);
    return { x: projected[0], y: projected[1] };
  });
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.state.lastNote?.tooth)).toBe(36);
});

test('successive tunes shift the packed cylinder and trigger one indexing click', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.__CRESCENDO__.loadSpec({
      title: 'Indexed regression', duration: 20, turns: 3,
      notes: [{ tooth: 24, time: 0 }, { tooth: 28, time: 0.3, turn: 1 }, { tooth: 31, time: 0.3, turn: 2 }],
    }, null, false);
    window.__CRESCENDO__.transport.seek(19.5);
  });
  await page.locator('#playBtn').click();
  await expect(page.locator('#indexCue')).toHaveClass(/active/);
  await expect(page.locator('#indexMessage')).toHaveText('Indexing · tune 2 of 3');
  await expect(page.locator('#turnOut')).toHaveClass(/indexing/);
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.transport.position())).toBeGreaterThan(20.3);
  await expect(page.locator('#turnOut')).toHaveText('2 / 3');
  const indexed = await page.evaluate(() => ({
    clicks: window.__CRESCENDO__.sound.startedIndexClicks,
    x: window.__CRESCENDO__.scene.rotorParts[0].matrix[12],
  }));
  expect(indexed.clicks).toBe(1);
  expect(indexed.x).toBeCloseTo(0.030 - 0.00055, 5);
  await expect(page.locator('#indexCue')).not.toHaveClass(/active/);
  expect(await page.evaluate(() => window.__CRESCENDO__.scene.indexHighlight)).toBe(0);
  await page.locator('#playBtn').click();
});

test('resonance is opt-in and follows audible note decay after the transport ends', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#showResonance')).not.toBeChecked();
  await page.evaluate(() => window.__CRESCENDO__.loadSpec({
    title: 'Decay regression', duration: 2, notes: [{ tooth: 24, time: 0 }],
  }, null, false));
  await page.getByText('Show resonance', { exact: true }).click();
  await page.locator('#playBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.state.resonances.length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.transport.running)).toBe(false);
  expect(await page.evaluate(() => window.__CRESCENDO__.state.resonances.length)).toBe(1);
  expect(await page.evaluate(() => window.__CRESCENDO__.state.showResonance)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.state.resonances.length), {
    timeout: 14000,
  }).toBe(0);
});

test('fullscreen uses the entire display for the scene', async ({ page }) => {
  await ready(page);
  await page.locator('#fullBtn').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('sceneStage');
  const bounds = await page.locator('#sceneCanvas').boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(bounds.width).toBe(viewport.width);
  expect(bounds.height).toBe(viewport.height);
  await page.locator('#fullBtn').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test('dragging the pin timeline preserves playback and seeks across tunes', async ({ page }) => {
  await ready(page);
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => window.__CRESCENDO__.transport.running);
  const bounds = await page.locator('#timeline').boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__CRESCENDO__.transport.running)).toBe(true);
  await expect(page.locator('#turnOut')).toHaveText('3 / 3');
  await page.locator('#playBtn').click();
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
