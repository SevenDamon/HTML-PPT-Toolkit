import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const url = process.argv[2];
const shouldSave = process.argv.includes('--save');
const shouldPdf = process.argv.includes('--pdf');
const shouldPptx = process.argv.includes('--pptx');
const shouldPptxVisual = process.argv.includes('--pptx-visual');
const screenshotArg = process.argv.indexOf('--screenshot');
const screenshotPath = screenshotArg >= 0 ? process.argv[screenshotArg + 1] : null;
if (!url) {
  console.error('用法: node smoke-test-iframe.mjs <studio-url>');
  process.exit(2);
}

const dashi = process.env.DASHI_PPT_PROJECT || path.join(os.homedir(), '.codex', 'skills', 'dashiai-ppt', 'project');
const [{ chromium }, { getExportBrowserPath }] = await Promise.all([
  import(pathToFileURL(path.join(dashi, 'node_modules', 'playwright-core', 'index.mjs'))),
  import(pathToFileURL(path.join(dashi, 'scripts', 'chrome-path.mjs')))
]);

const browser = await chromium.launch({ headless: true, executablePath: getExportBrowserPath() });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
const consoleMessages = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  let target = null;
  for (const frame of page.frames()) {
    try {
      if (await frame.evaluate(() => Boolean(document.querySelector('.hppt-dock')))) {
        target = frame;
        break;
      }
    } catch (error) {}
  }
  if (!target) throw new Error('没有在内嵌课件页中发现工具栏');

  await target.evaluate(() => window.__htmlPptEditor.setEditing(true));
  const beforeDock = await target.evaluate(() => {
    const rect = document.querySelector('.hppt-dock').getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  });
  const handleBox = await target.locator('.hppt-drag-handle').boundingBox();
  if (!handleBox) throw new Error('没有发现工具栏拖拽把手');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 90, handleBox.y + 70, { steps: 8 });
  await page.mouse.up();
  const dockDragResult = await target.evaluate(() => {
    const rect = document.querySelector('.hppt-dock').getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  const sizeBefore = await target.evaluate(() => ({ factor: getComputedStyle(document.documentElement).getPropertyValue('--hppt-ui-factor').trim(), width: document.querySelector('.hppt-dock').getBoundingClientRect().width }));
  await target.evaluate(() => document.querySelector('[data-size="down"]').click());
  await page.waitForTimeout(40);
  const sizeAfter = await target.evaluate(() => ({ factor: getComputedStyle(document.documentElement).getPropertyValue('--hppt-ui-factor').trim(), width: document.querySelector('.hppt-dock').getBoundingClientRect().width }));
  await target.evaluate(() => document.querySelector('[data-size="up"]').click());
  const changed = await target.evaluate(() => {
    const element = document.querySelector('[data-hppt-editable]');
    if (!element) return false;
    element.click();
    const before = getComputedStyle(element).color;
    document.querySelector('[data-id="color"]').click();
    document.querySelector('[data-color="#c0392b"]').click();
    return before !== getComputedStyle(element).color;
  });
  await target.evaluate(() => document.querySelector('[data-id="move"]').click());
  const movableCount = await target.evaluate(() => document.querySelectorAll('[data-hppt-drag]:not(.hppt-removed)').length);
  if (!movableCount) {
    const debug = await target.evaluate(() => [...document.querySelectorAll('[data-hppt-editable]')].map((element) => ({ tag: element.tagName, className: element.className, attrs: [...element.attributes].map((attribute) => attribute.name) })));
    throw new Error(`编辑器未标记可拖动元素：${JSON.stringify(debug)}`);
  }
  const movable = target.locator('[data-hppt-drag]:not(.hppt-removed)').first();
  const moveBox = await movable.boundingBox();
  if (!moveBox) throw new Error('没有发现可拖动元素');
  const elementBeforeMove = await movable.evaluate((element) => ({ x: element.dataset.hpptX, y: element.dataset.hpptY, translate: element.style.translate }));
  await page.mouse.move(moveBox.x + Math.min(moveBox.width / 2, 30), moveBox.y + Math.min(moveBox.height / 2, 20));
  await page.mouse.down();
  await page.mouse.move(moveBox.x + 70, moveBox.y + 55, { steps: 8 });
  await page.mouse.up();
  const elementAfterMove = await movable.evaluate((element) => ({ x: element.dataset.hpptX, y: element.dataset.hpptY, translate: element.style.translate }));
  await target.evaluate(() => document.querySelector('[data-id="move"]').click());
  const directBox = await target.locator('.hppt-move-edge[data-edge="n"]').boundingBox();
  if (!directBox) throw new Error('没有发现可拖动的选中框边框');
  const directBefore = await movable.evaluate((element) => ({ x: element.dataset.hpptX, y: element.dataset.hpptY, translate: element.style.translate }));
  await page.mouse.move(directBox.x + Math.min(directBox.width / 2, 28), directBox.y + directBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(directBox.x + 62, directBox.y + directBox.height / 2 + 48, { steps: 7 });
  await page.mouse.up();
  const directAfter = await movable.evaluate((element) => ({ x: element.dataset.hpptX, y: element.dataset.hpptY, translate: element.style.translate }));
  const result = await target.evaluate(() => ({
    toolbar: document.querySelectorAll('.hppt-dock').length,
    toolbarGroups: document.querySelectorAll('.hppt-group').length,
    toolbarColumns: getComputedStyle(document.querySelector('.hppt-group > div')).gridTemplateColumns.split(' ').length,
    editorVersion: window.HtmlPptEditor?.version,
    ready: document.documentElement.dataset.hpptReady,
    editableTexts: document.querySelectorAll('[data-hppt-editable]').length,
    editorSlides: window.__htmlPptEditor?.slides.length
  }));
  result.dockMoved = Math.abs(dockDragResult.left - beforeDock.left) > 8 || Math.abs(dockDragResult.top - beforeDock.top) > 8;
  result.dockVisible = dockDragResult.left >= -1 && dockDragResult.top >= -1 && dockDragResult.right <= dockDragResult.width + 12 && dockDragResult.bottom <= dockDragResult.height + 12;
  result.dockRect = dockDragResult;
  result.toolbarSizeChanged = sizeBefore.factor !== sizeAfter.factor && sizeAfter.width < sizeBefore.width;
  result.elementMoved = elementBeforeMove.x !== elementAfterMove.x || elementBeforeMove.y !== elementAfterMove.y || elementBeforeMove.translate !== elementAfterMove.translate;
  result.directElementMoved = directBefore.x !== directAfter.x || directBefore.y !== directAfter.y || directBefore.translate !== directAfter.translate;
  await target.evaluate(() => document.querySelector('[data-id="focus"]').click());
  await page.waitForTimeout(80);
  result.focusModeOn = await page.evaluate(() => document.documentElement.classList.contains('hppt-focus-mode'));
  result.watermarkHidden = await page.evaluate(() => {
    const element = document.querySelector('.watermark-overlay,.ai-badge,.watermark-content');
    return !element || getComputedStyle(element).display === 'none';
  });
  await target.evaluate(() => document.querySelector('[data-id="focus"]').click());
  await page.waitForTimeout(80);
  result.focusModeRestored = await page.evaluate(() => !document.documentElement.classList.contains('hppt-focus-mode'));
  const manualTargetExists = await page.evaluate(() => Boolean(document.querySelector('.watermark-overlay,.ai-badge,.watermark-content')));
  if (manualTargetExists) {
    await target.evaluate(() => document.querySelector('[data-id="watermarkPick"]').click());
    await page.locator('.watermark-overlay,.ai-badge,.watermark-content').first().dispatchEvent('pointerdown');
    await page.waitForTimeout(80);
    result.manualHideWorked = await page.evaluate(() => {
      const element = document.querySelector('.watermark-overlay,.ai-badge,.watermark-content');
      return Boolean(element && element.hasAttribute('data-hppt-outer-deleted') && getComputedStyle(element).display === 'none');
    });
    await target.evaluate(() => document.querySelector('[data-id="outerUndo"]').click());
  } else result.manualHideWorked = true;
  if (shouldSave) {
    const saved = page.waitForResponse((response) => response.url().includes('/api/save-source') && response.request().method() === 'POST');
    await target.evaluate(() => document.querySelector('[data-id="saveSource"]').click());
    const response = await saved;
    result.savedSource = response.ok();
  }
  if (shouldPdf) {
    const exported = page.waitForResponse((response) => response.url().includes('/api/project-export?format=pdf') && response.request().method() === 'POST', { timeout: 180000 });
    await target.evaluate(() => document.querySelector('[data-id="pdf"]').click());
    const response = await exported;
    result.exportedPdf = response.ok();
    result.exportedPdfBytes = Number(response.headers()['content-length'] || 0);
  }
  if (shouldPptx) {
    const exported = page.waitForResponse((response) => response.url().includes('/api/project-export?format=pptx') && response.request().method() === 'POST', { timeout: 180000 });
    await target.evaluate(() => document.querySelector('[data-id="pptx"]').click());
    const response = await exported;
    result.exportedPptx = response.ok();
    result.exportedPptxBytes = Number(response.headers()['content-length'] || 0);
  }
  if (shouldPptxVisual) {
    const exported = page.waitForResponse((response) => response.url().includes('/api/project-export?format=pptx') && response.request().method() === 'POST', { timeout: 180000 });
    await target.evaluate(() => document.querySelector('[data-id="pptxVisual"]').click());
    const response = await exported;
    result.exportedVisualPptx = response.ok();
    result.exportedVisualPptxBytes = Number(response.headers()['content-length'] || 0);
  }
  if (screenshotPath) {
    await target.evaluate(() => {
      window.__htmlPptEditor.setEditing(true);
      const number = document.querySelector('.hppt-number');
      if (number) { number.disabled = false; number.value = '100'; }
    });
    await target.locator('.hppt-dock').screenshot({ path: path.resolve(screenshotPath) });
    result.screenshot = path.resolve(screenshotPath);
  }
  let controller = null;
  for (const frame of page.frames()) {
    try {
      if (await frame.evaluate(() => Boolean(document.querySelector('.cw-thumb-item')))) { controller = frame; break; }
    } catch (error) {}
  }
  if (!controller) throw new Error('没有发现 iframe 课件控制器');
  await controller.evaluate(() => document.querySelectorAll('.cw-thumb-item')[1]?.click());
  await page.waitForTimeout(700);
  let secondToolbar = 0;
  for (const frame of page.frames()) {
    try {
      const check = await frame.evaluate(() => ({ toolbar: document.querySelectorAll('.hppt-dock').length, text: document.body?.innerText || '' }));
      if (check.toolbar && check.text.includes('向下拽动')) secondToolbar = check.toolbar;
    } catch (error) {}
  }
  Object.assign(result, {
    format: await page.evaluate(() => window.__htmlPptFrameAdapter?.format),
    totalFrames: page.frames().length,
    colorChanged: changed,
    pageSwitchToolbar: secondToolbar,
    errors,
    editorWarnings: consoleMessages.filter((message) => message.includes('HtmlPptEditor'))
  });
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.toolbar !== 1 || result.toolbarGroups < 6 || result.toolbarColumns !== 2 || !result.dockMoved || !result.dockVisible || !result.toolbarSizeChanged || !result.elementMoved || !result.directElementMoved || !result.focusModeOn || !result.watermarkHidden || !result.focusModeRestored || !result.manualHideWorked || !changed || result.pageSwitchToolbar !== 1 || result.format !== 'iframe-template' || (shouldSave && !result.savedSource) || (shouldPdf && !result.exportedPdf) || (shouldPptx && !result.exportedPptx) || (shouldPptxVisual && !result.exportedVisualPptx)) process.exitCode = 1;
} finally {
  await browser.close();
}
