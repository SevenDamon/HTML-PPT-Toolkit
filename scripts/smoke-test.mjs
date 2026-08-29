import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const url = process.argv[2];
if (!url) {
  console.error('用法: node smoke-test.mjs <studio-url>');
  process.exit(2);
}

const dashi = process.env.DASHI_PPT_PROJECT || path.join(os.homedir(), '.codex', 'skills', 'dashiai-ppt', 'project');
const [{ chromium }, { getExportBrowserPath }] = await Promise.all([
  import(pathToFileURL(path.join(dashi, 'node_modules', 'playwright-core', 'index.mjs'))),
  import(pathToFileURL(path.join(dashi, 'scripts', 'chrome-path.mjs')))
]);

const browser = await chromium.launch({ headless: true, executablePath: getExportBrowserPath() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
const consoleMessages = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hppt-dock');
  await page.waitForTimeout(100);
  const startup = await page.evaluate(() => ({ ready: document.documentElement.dataset.hpptReady, api: Boolean(window.__htmlPptEditor) }));
  if (!startup.api) throw new Error(`编辑器初始化未完成：${JSON.stringify({ startup, consoleMessages })}`);
  await page.evaluate(() => window.__htmlPptEditor.setEditing(true));
  const editable = page.locator('.slide.active [data-hppt-editable]').first();
  await page.evaluate(() => document.querySelector('.slide.active [data-hppt-editable]').click());
  const before = await editable.evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => {
    document.querySelector('[data-id="color"]').click();
    document.querySelector('[data-color="#c0392b"]').click();
  });
  const after = await editable.evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => document.querySelector('[data-id="add"]').click());
  const added = await page.locator('.slide.active .hppt-user-text').count();
  await page.evaluate(() => document.querySelector('[data-id="undo"]').click());
  const afterUndo = await page.locator('.slide.active .hppt-user-text').count();
  const overflowClearedForPresentation = await page.evaluate(() => {
    const element = document.querySelector('.slide.active [data-hppt-editable]');
    element.classList.add('hppt-overflow');
    window.__htmlPptEditor.setEditing(false);
    const cleared = !element.classList.contains('hppt-overflow') && getComputedStyle(element).outlineStyle !== 'dashed';
    window.__htmlPptEditor.setEditing(true);
    return cleared;
  });
  const result = await page.evaluate(() => ({
    slides: document.querySelectorAll('.slide').length,
    docks: document.querySelectorAll('.hppt-dock').length,
    toolbarButtons: document.querySelectorAll('.hppt-dock button').length,
    profile: window.HTML_PPT_EDITOR_PROFILE || window.HTML_PPT_EDITOR_CONFIG?.profile || 'lite',
    visiblePageTools: ['titleEdit', 'focus', 'watermarkPick', 'outerUndo'].filter((id) => {
      const button = document.querySelector(`[data-id="${id}"]`);
      return button && getComputedStyle(button).display !== 'none' && button.getBoundingClientRect().width > 0;
    }),
    legacyToolbar: Boolean(document.querySelector('#editDock')),
    editorVersion: window.HtmlPptEditor?.version,
    overflowSlides: [...document.querySelectorAll('.slide')].filter((slide) => slide.scrollWidth > slide.clientWidth + 2 || slide.scrollHeight > slide.clientHeight + 2).length
  }));
  Object.assign(result, { colorChanged: before !== after, addedText: added === 1, undoWorked: afterUndo === 0, overflowClearedForPresentation, errors });
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || !result.colorChanged || !result.addedText || !result.undoWorked || !result.overflowClearedForPresentation || result.docks !== 1 || (result.profile === 'full' && result.visiblePageTools.length !== 4)) process.exitCode = 1;
} finally {
  await browser.close();
}
