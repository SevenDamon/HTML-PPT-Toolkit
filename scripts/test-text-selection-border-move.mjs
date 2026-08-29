import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const url = process.argv[2];
if (!url) throw new Error('用法: node test-text-selection-border-move.mjs <studio-url>');
const dashi = process.env.DASHI_PPT_PROJECT || path.join(os.homedir(), '.codex', 'skills', 'dashiai-ppt', 'project');
const [{ chromium }, { getExportBrowserPath }] = await Promise.all([
  import(pathToFileURL(path.join(dashi, 'node_modules', 'playwright-core', 'index.mjs'))),
  import(pathToFileURL(path.join(dashi, 'scripts', 'chrome-path.mjs')))
]);

const browser = await chromium.launch({ headless: true, executablePath: getExportBrowserPath() });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let frame = null;
  for (let attempt = 0; attempt < 30 && !frame; attempt++) {
    await page.waitForTimeout(500);
    for (const candidate of page.frames()) {
      try {
        if (await candidate.evaluate(() => Boolean(document.querySelector('.hppt-dock')))) { frame = candidate; break; }
      } catch {}
    }
  }
  if (!frame) throw new Error('未发现编辑器 iframe');
  const metrics = await frame.evaluate(() => {
    window.__htmlPptEditor.setEditing(true);
    const candidates = [...document.querySelectorAll('[data-hppt-editable]')];
    const element = candidates.find(node => node.matches('h1,h2,h3,.title') && (node.textContent || '').trim().length >= 6)
      || candidates.find(node => (node.textContent || '').trim().length >= 6);
    if (!element) throw new Error('没有可供测试的文本框');
    element.dataset.hpptSelectionMoveTest = '1';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = null;
    while (walker.nextNode()) {
      if ((walker.currentNode.nodeValue || '').trim().length >= 6) { textNode = walker.currentNode; break; }
    }
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const textRect = range.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    return {
      left: (textRect.left - elementRect.left) / elementRect.width,
      top: (textRect.top - elementRect.top) / elementRect.height,
      width: textRect.width / elementRect.width,
      height: textRect.height / elementRect.height,
      x: element.dataset.hpptX || '0',
      y: element.dataset.hpptY || '0'
    };
  });
  const element = frame.locator('[data-hppt-selection-move-test="1"]');
  const box = await element.boundingBox();
  if (!box) throw new Error('未取得文本框位置');
  // Match the real editing gesture: first select/focus the text box, then drag
  // across its text. The first pointerdown is intentionally used by the editor
  // to establish the active box and show its movable border.
  await element.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page.waitForTimeout(80);
  const startX = box.x + box.width * (metrics.left + metrics.width * 0.12);
  const endX = box.x + box.width * (metrics.left + metrics.width * 0.62);
  const textY = box.y + box.height * (metrics.top + metrics.height * 0.55);
  await page.mouse.move(startX, textY);
  await page.mouse.down();
  await page.mouse.move(endX, textY, { steps: 12 });
  await page.mouse.up();
  const afterSelection = await frame.evaluate(() => {
    const element = document.querySelector('[data-hppt-selection-move-test="1"]');
    return {
      selected: getSelection().toString(),
      x: element.dataset.hpptX || '0',
      y: element.dataset.hpptY || '0',
      resizeVisible: document.querySelector('.hppt-resize-box')?.classList.contains('hppt-visible'),
      fontUnlocked: !document.querySelector('[data-id="fontDown"]').disabled && !document.querySelector('[data-id="fontUp"]').disabled && !document.querySelector('[data-id="font"]').disabled,
      colorUnlocked: !document.querySelector('[data-id="color"]').disabled,
      boxFont: element.style.fontSize || ''
    };
  });
  if (!afterSelection.selected.trim()) throw new Error(`鼠标左键拖动未产生文字选区；metrics=${JSON.stringify(metrics)} box=${JSON.stringify(box)} state=${JSON.stringify(afterSelection)}`);
  if (afterSelection.x !== metrics.x || afterSelection.y !== metrics.y) throw new Error('框选文字时文本框发生了移动');
  if (!afterSelection.resizeVisible) throw new Error('选中文字后未显示文本框边框');
  if (!afterSelection.fontUnlocked || !afterSelection.colorUnlocked) throw new Error('选中文字后文字工具仍被锁定');
  const partialFont = await frame.evaluate(() => {
    const element = document.querySelector('[data-hppt-selection-move-test="1"]');
    const selected = getSelection().toString();
    document.querySelector('[data-id="fontUp"]').click();
    const span = [...element.querySelectorAll('span')].find(node => Boolean(node.style.fontSize));
    return { selected, styledText: span?.textContent || '', spanFont: span?.style.fontSize || '', boxFont: element.style.fontSize || '' };
  });
  if (!partialFont.spanFont || partialFont.styledText !== partialFont.selected) throw new Error('字号没有只作用于选中文字');
  if (partialFont.boxFont !== afterSelection.boxFont) throw new Error('局部改字号错误地修改了整个文本框');
  const wholeFont = await frame.evaluate(() => {
    const element = document.querySelector('[data-hppt-selection-move-test="1"]');
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.querySelector('[data-id="fontUp"]').click();
    return { boxFont: element.style.fontSize || '', remainingInlineFonts: [...element.querySelectorAll('[style]')].filter(node => Boolean(node.style.fontSize)).length };
  });
  if (!wholeFont.boxFont || wholeFont.remainingInlineFonts) throw new Error('整框改字号未清理局部字号覆盖');
  const edge = frame.locator('.hppt-move-edge[data-edge="n"]');
  const edgeBox = await edge.boundingBox();
  if (!edgeBox) throw new Error('未发现可拖动的文本框边框');
  await page.mouse.move(edgeBox.x + edgeBox.width * 0.35, edgeBox.y + edgeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(edgeBox.x + edgeBox.width * 0.35 + 52, edgeBox.y + edgeBox.height / 2 + 36, { steps: 10 });
  await page.mouse.up();
  const afterMove = await frame.evaluate(() => {
    const element = document.querySelector('[data-hppt-selection-move-test="1"]');
    return { x: element.dataset.hpptX || '0', y: element.dataset.hpptY || '0', version: window.HtmlPptEditor.version };
  });
  if (afterMove.x === afterSelection.x && afterMove.y === afterSelection.y) throw new Error('拖动边框没有移动文本框');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ afterSelection, partialFont, wholeFont, afterMove }, null, 2));
} finally {
  await browser.close();
}
