import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';

const url = process.argv[2];
if (!url) throw new Error('用法: node test-protected-editable.mjs <deck-url>');

const dashi = process.env.DASHI_PPT_PROJECT || path.join(os.homedir(), '.codex', 'skills', 'dashiai-ppt', 'project');
const [{ chromium }, { getExportBrowserPath }] = await Promise.all([
  import(pathToFileURL(path.join(dashi, 'node_modules', 'playwright-core', 'index.mjs'))),
  import(pathToFileURL(path.join(dashi, 'scripts', 'chrome-path.mjs')))
]);

const browser = await chromium.launch({ headless: true, executablePath: getExportBrowserPath() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hppt-protected-editable-'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hppt-dock');
  await page.evaluate(() => {
    window.go(10);
    window.__htmlPptEditor.setEditing(true);
  });

  const selectors = ['#p11 header .chapter', '#p11 header span:nth-child(2)', '#p11 header .session', '#p11 .demo-button', '#p11 .source-note'];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if (await locator.getAttribute('data-hppt-editable') === null) throw new Error(`${selector} 未被识别为可编辑文字`);
    if (await locator.getAttribute('contenteditable') !== 'true') throw new Error(`${selector} 未进入文字编辑状态`);
  }

  const source = page.locator('#p11 .source-note');
  const original = await source.textContent();
  await source.fill(`${original}（测试）`);
  if (!(await source.textContent()).endsWith('（测试）')) throw new Error('来源说明无法通过真实输入修改');
  await source.fill(original);
  await source.click();

  const protectedState = await page.evaluate(() => ({
    removeDisabled: document.querySelector('[data-id="remove"]').disabled,
    resizeVisible: document.querySelector('.hppt-resize-box').classList.contains('hppt-visible'),
    sourceDraggable: document.querySelector('#p11 .source-note').hasAttribute('data-hppt-drag'),
    sourceAnimated: document.querySelector('#p11 .source-note').hasAttribute('data-hppt-anim'),
    pageNumberEditable: document.querySelector('#p11 footer span').hasAttribute('data-hppt-editable') || document.querySelector('#p11 footer span').isContentEditable
  }));

  await page.locator('#p11 .demo-button').click();
  const dialogOpened = await page.locator('dialog[open]').count();
  const savedTexts = {};
  for (const selector of ['#p11 header .session', '#p11 .source-note', '#p11 .demo-button']) {
    const locator = page.locator(selector);
    await locator.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' EDIT');
    savedTexts[selector] = await locator.textContent();
    if (!savedTexts[selector].includes('EDIT')) throw new Error(`${selector} 无法点击后直接输入`);
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-id="html"]').click()
  ]);
  const exportedPath = path.join(tempDir, 'exported.html');
  await download.saveAs(exportedPath);
  const exportedPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await exportedPage.goto(pathToFileURL(exportedPath).href, { waitUntil: 'networkidle' });
  await exportedPage.waitForSelector('.hppt-dock');
  const exported = await exportedPage.evaluate(() => ({
    version: window.HtmlPptEditor?.version,
    sourceEditable: document.querySelector('#p11 .source-note')?.hasAttribute('data-hppt-editable'),
    editorInline: [...document.querySelectorAll('script:not([src])')].some(script => script.textContent.includes('HtmlPptEditor'))
  }));
  for (const [selector, text] of Object.entries(savedTexts)) {
    if (await exportedPage.locator(selector).textContent() !== text) throw new Error(`${selector} 导出后文字丢失`);
  }
  await exportedPage.evaluate(() => window.go(10));
  await exportedPage.locator('#p11 .demo-button').click();
  exported.presentationAction = await exportedPage.locator('#detail[open]').count() === 1;
  exported.changedTextsRetained = true;
  await exportedPage.close();
  const report = await page.evaluate(() => ({
    version: window.HtmlPptEditor?.version,
    editableHeaderTexts: document.querySelectorAll('header[data-ppt-protected] > [data-hppt-editable]').length,
    editableSourceNotes: document.querySelectorAll('.source-note[data-hppt-editable]').length,
    editableDemoButtons: document.querySelectorAll('.demo-button[data-hppt-editable]').length
  }));
  Object.assign(report, protectedState, { dialogOpened, exported, errors });
  console.log(JSON.stringify(report, null, 2));

  if (errors.length || report.editableHeaderTexts !== 72 || report.editableSourceNotes !== 10 || report.editableDemoButtons !== 2 || !report.removeDisabled || report.resizeVisible || report.sourceDraggable || report.sourceAnimated || report.pageNumberEditable || dialogOpened || exported.version !== report.version || !exported.sourceEditable || !exported.editorInline || !exported.presentationAction) process.exitCode = 1;
} finally {
  await browser.close();
  await rm(tempDir, { recursive: true, force: true });
}
