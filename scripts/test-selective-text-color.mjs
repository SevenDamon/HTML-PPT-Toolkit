import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const url = process.argv[2];
if (!url) throw new Error('用法: node test-selective-text-color.mjs <studio-url>');
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
  await page.goto(url, { waitUntil: 'networkidle' });
  let frame = null;
  for (let attempt = 0; attempt < 12 && !frame; attempt++) {
    await page.waitForTimeout(500);
    for (const candidate of page.frames()) {
      try {
        if (await candidate.evaluate(() => Boolean(document.querySelector('.hppt-dock')))) { frame = candidate; break; }
      } catch {}
    }
  }
  if (!frame) throw new Error('未发现编辑器 iframe');
  const report = await frame.evaluate(() => {
    window.__htmlPptEditor.setEditing(true);
    const element = [...document.querySelectorAll('[data-hppt-editable]')].find(node => (node.textContent || '').trim().length >= 4);
    if (!element) throw new Error('没有可供测试的文本框');
    element.click();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = null;
    while (walker.nextNode()) {
      if ((walker.currentNode.nodeValue || '').trim().length >= 4) { textNode = walker.currentNode; break; }
    }
    if (!textNode) throw new Error('文本框没有可选择的文字节点');
    const source = textNode.nodeValue;
    const start = Math.max(0, source.search(/\S/));
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, Math.min(source.length, start + 2));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.querySelector('[data-id="color"]').click();
    document.querySelector('[data-color="#c0392b"]').click();
    const localSpan = [...element.querySelectorAll('span')].find(span => span.style.color === 'rgb(192, 57, 43)' || span.style.color === '#c0392b');
    const localResult = {
      selectedText: source.slice(start, start + 2),
      coloredText: localSpan?.textContent || '',
      boxInlineColor: element.style.color || '',
      localSpanColor: localSpan?.style.color || ''
    };
    const collapsed = document.createRange();
    collapsed.selectNodeContents(element);
    collapsed.collapse(false);
    selection.removeAllRanges();
    selection.addRange(collapsed);
    document.dispatchEvent(new Event('selectionchange'));
    document.querySelector('[data-id="color"]').click();
    document.querySelector('[data-color="#2980b9"]').click();
    return {
      localResult,
      wholeBoxColor: element.style.color,
      remainingInlineColors: [...element.querySelectorAll('[style]')].filter(node => Boolean(node.style.color)).length,
      html: element.innerHTML,
      version: window.HtmlPptEditor.version
    };
  });
  if (report.localResult.coloredText !== report.localResult.selectedText) throw new Error('局部颜色没有只作用于选中文字');
  if (report.localResult.boxInlineColor) throw new Error('局部改色错误地修改了整个文本框');
  if (report.wholeBoxColor !== 'rgb(41, 128, 185)' && report.wholeBoxColor !== '#2980b9') throw new Error('整框颜色修改失败');
  if (report.remainingInlineColors !== 0) throw new Error('整框改色后仍残留局部颜色覆盖');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
