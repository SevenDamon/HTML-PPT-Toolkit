import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const url = process.argv[2];
if (!url) throw new Error('用法: node test-shape-library.mjs <studio-url>');
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
  await page.waitForTimeout(900);
  const target = page.frames().find(async frame => frame.evaluate(() => Boolean(document.querySelector('.hppt-dock'))));
  let editorFrame = null;
  for (const frame of page.frames()) {
    try {
      if (await frame.evaluate(() => Boolean(document.querySelector('.hppt-dock')))) { editorFrame = frame; break; }
    } catch {}
  }
  if (!target || !editorFrame) throw new Error('未发现编辑器 iframe');
  const report = await editorFrame.evaluate(() => {
    window.__htmlPptEditor.setEditing(true);
    document.querySelector('[data-id="shapeAdd"]').click();
    const palette = document.querySelector('.hppt-shape-palette');
    const buttons = [...palette.querySelectorAll('[data-shape-type]')];
    const types = buttons.map(button => button.dataset.shapeType);
    buttons.forEach(button => {
      document.querySelector('[data-id="shapeAdd"]').click();
      button.click();
    });
    const shapes = [...document.querySelectorAll('.hppt-user-shape.hppt-vector-shape')];
    const ellipse = shapes.find(shape => shape.dataset.hpptShapeType === 'circle');
    ellipse.style.width = '420px';
    ellipse.style.setProperty('height', '180px', 'important');
    ellipse.click();
    document.querySelector('[data-id="shapeFill"]').click();
    document.querySelector('[data-color="#2980b9"]').click();
    document.querySelector('[data-id="shapeStroke"]').click();
    document.querySelector('[data-color="#c0392b"]').click();
    const border = document.querySelector('[data-id="shapeBorder"]');
    border.value = '7';
    border.dispatchEvent(new Event('change', { bubbles: true }));
    const state = window.__htmlPptEditor.snapshot();
    const saved = state.shapes.find(shape => shape.key === ellipse.dataset.hpptKey);
    ellipse.remove();
    window.__htmlPptEditor.applyState(state);
    const restored = document.querySelector('[data-hppt-key="' + CSS.escape(saved.key) + '"]');
    return {
      paletteOpen: palette.classList.contains('hppt-open'),
      paletteCount: buttons.length,
      types,
      createdCount: shapes.length,
      allHaveSvg: shapes.every(shape => Boolean(shape.querySelector('svg > *'))),
      ellipseSize: { width: ellipse.style.width, height: ellipse.style.height },
      restoredType: restored?.dataset.hpptShapeType,
      restoredSvg: restored?.querySelector('svg > *')?.tagName,
      restoredFill: restored?.style.getPropertyValue('--hppt-shape-fill'),
      restoredStroke: restored?.style.getPropertyValue('--hppt-shape-stroke'),
      restoredBorder: restored?.style.getPropertyValue('--hppt-shape-stroke-width'),
      radiusDisabled: document.querySelector('[data-id="shapeRadius"]').disabled,
      toolbarEditableLeak: document.querySelectorAll('[data-hppt-ui] [data-hppt-editable]').length
    };
  });
  const expected = ['rect','roundRect','circle','ellipse','triangle','diamond','pentagon','hexagon','parallelogram','trapezoid','chevron','rightArrow','star'];
  if (report.paletteCount !== expected.length || report.types.join(',') !== expected.join(',')) throw new Error('图形库项目不完整');
  if (report.createdCount !== expected.length || !report.allHaveSvg) throw new Error('部分图形未正确创建');
  if (report.ellipseSize.width !== '420px' || report.ellipseSize.height !== '180px') throw new Error('圆形不能自由拉伸为椭圆');
  if (report.restoredType !== 'circle' || !report.restoredSvg) throw new Error('图形保存恢复丢失');
  if (report.restoredFill !== '#2980b9' || report.restoredStroke !== '#c0392b' || report.restoredBorder !== '7') throw new Error('图形样式保存恢复丢失');
  if (!report.radiusDisabled) throw new Error('矢量图形不应启用 CSS 圆角');
  if (report.toolbarEditableLeak) throw new Error('工具栏内容被错误标记为可编辑');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
