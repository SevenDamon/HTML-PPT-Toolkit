import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
let input = null;
let expectedProfile = null;
for (let index = 0; index < argv.length; index++) {
  const arg = argv[index];
  if (arg === '--profile') { expectedProfile = String(argv[++index] || '').toLowerCase(); continue; }
  if (arg.startsWith('--profile=')) { expectedProfile = arg.slice('--profile='.length).toLowerCase(); continue; }
  if (!arg.startsWith('--') && !input) input = arg;
}
if (expectedProfile && !['lite', 'full'].includes(expectedProfile)) {
  console.error('无效的 --profile，请使用 lite 或 full。');
  process.exit(2);
}
if (!input) {
  console.error('用法: node check-deck.mjs <deck.html> [--profile lite|full]');
  process.exit(2);
}

const file = resolve(input);
const html = readFileSync(file, 'utf8');
const errors = [];
const warnings = [];
const risks = [];
const slideTags = [...html.matchAll(/<(?:section|article|div)\b[^>]*(?:class=["'][^"']*\bslide\b[^"']*["']|data-ppt-slide(?:=["'][^"']*["'])?)[^>]*>/gi)].map(match => match[0]);
const encodedIframePages = [...html.matchAll(/&lt;template\b(?:(?!&gt;)[\s\S])*?class=&quot;page-data&quot;/gi)].length;
const literalIframePages = [...html.matchAll(/<template\b[^>]*class=["'][^"']*\bpage-data\b[^"']*["'][^>]*>/gi)].length;
const iframeTemplate = /<iframe\b[^>]*class=["'][^"']*\bcontent-iframe\b[^"']*["'][^>]*\bsrcdoc=/i.test(html) && encodedIframePages + literalIframePages > 0;
const iframePages = iframeTemplate ? encodedIframePages + literalIframePages : 0;
const ids = slideTags.map(tag => tag.match(/\bid=["']([^"']+)["']/i)?.[1]).filter(Boolean);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const editorLinked = /html-ppt-editor\.js/i.test(html);
const embeddedProfile = html.match(/HTML_PPT_EDITOR_PROFILE\s*=\s*["'](lite|full)["']/i)?.[1]?.toLowerCase() || null;
const profile = embeddedProfile || (editorLinked ? (iframeTemplate ? 'full-legacy' : 'lite') : null);

if (!iframeTemplate && !/(?:id=["']deck["']|class=["'][^"']*\bstage\b|data-ppt-deck)/i.test(html)) errors.push('未发现演示容器（#deck、.stage 或 [data-ppt-deck]）。');
if (!iframeTemplate && !slideTags.length) errors.push('未发现任何 .slide 或 [data-ppt-slide] 页面。');
if (!iframeTemplate && slideTags.length && !slideTags.some(tag => /\bactive\b|aria-current=["']true["']|data-active=["']true["']/i.test(tag))) warnings.push('没有明确的当前页标记；编辑器将默认使用第一页。');
if (!iframeTemplate && ids.length !== slideTags.length) risks.push(`${slideTags.length - ids.length} 页没有唯一 id；保存状态、定位页面和逐页导出可能不稳定。`);
if (!iframeTemplate && duplicateIds.length) errors.push(`页面 id 重复：${duplicateIds.join(', ')}`);
if (!iframeTemplate && !/(?:1920\s*(?:px)?[^\n]{0,80}1080|aspect-ratio\s*:\s*16\s*\/\s*9|16\s*:\s*9)/i.test(html)) risks.push('未识别到明确的 16:9 画布声明；必须人工确认投屏和导出比例。');
if (!iframeTemplate && !/(?:window\.)?go\s*=|function\s+go\s*\(/i.test(html)) risks.push('未发现 window.go(index) 翻页接口；工作台无法保证逐页定位。');
if (!iframeTemplate && !/__getVisibleSlides/.test(html)) risks.push('未发现 window.__getVisibleSlides() 导出接口；工作台只能尝试自动发现页面。');
if (!iframeTemplate && !/(?:PageDown|ArrowDown)/.test(html)) warnings.push('未发现翻页笔常用按键信号处理。');
if (iframeTemplate && !/html-ppt-frame-adapter\.js/i.test(html)) warnings.push('已识别 iframe 模板课件，但尚未接入 iframe 编辑适配器。');
if (iframeTemplate) warnings.push('iframe 模板课件支持可编辑 PPTX 与保真图片版 PPTX；复杂蒙版、滤镜、交互和部分视觉效果在可编辑版中仍可能栅格化。');
if (editorLinked && !embeddedProfile) warnings.push(iframeTemplate ? '旧版 iframe 编辑器没有显式配置档；为保持兼容，运行时暂按 Full 处理。建议重新安装明确的 Lite/Full 配置。' : '未发现显式编辑器配置档标记；运行时将按 Lite 模式处理。');
const normalizedProfile = profile === 'full-legacy' ? 'full' : profile;
if (expectedProfile && normalizedProfile !== expectedProfile) errors.push(`编辑器配置档不匹配：期望 ${expectedProfile}，实际 ${profile || '未安装'}。`);
if (normalizedProfile === 'full') warnings.push('Full 模式的保存源文件、PDF 和 PPTX 导出需要通过本地 HTML PPT 工作台运行；直接 file:// 打开时这些按钮会禁用。');

const report = {
  file,
  compatible: errors.length === 0 && risks.length === 0,
  editorInstalled: editorLinked,
  format: iframeTemplate ? 'iframe-template' : 'standard',
  slides: iframeTemplate ? iframePages : slideTags.length,
  slideIds: iframeTemplate ? iframePages : ids.length,
  editorLinked,
  profile,
  capabilities: normalizedProfile === 'full'
    ? { edit: true, draft: true, exportHtml: true, pageTools: true, saveSource: true, exportPdf: true, exportPptx: true }
    : normalizedProfile === 'lite'
      ? { edit: true, draft: true, exportHtml: true, pageTools: false, saveSource: false, exportPdf: false, exportPptx: false }
      : null,
  errors,
  risks,
  warnings
};

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : risks.length ? 3 : 0);
