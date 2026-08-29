#!/usr/bin/env node
import path from 'node:path';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
let profile = 'lite';
let strip = false;
const positional = [];
for (let index = 0; index < argv.length; index++) {
  const arg = argv[index];
  if (arg === '--strip-legacy') { strip = true; continue; }
  if (arg === '--profile') {
    if (!argv[index + 1]) fail('Missing value after --profile (lite|full)');
    profile = String(argv[++index]).toLowerCase();
    continue;
  }
  if (arg.startsWith('--profile=')) { profile = arg.slice('--profile='.length).toLowerCase(); continue; }
  if (arg.startsWith('--')) fail(`Unknown option: ${arg}`);
  positional.push(arg);
}
if (!['lite', 'full'].includes(profile)) fail('Invalid --profile value. Use lite or full.');
if (!positional[0]) fail('Usage: node install-editor.mjs <input.html> [output.html] [--profile lite|full] [--strip-legacy]');

const input = path.resolve(positional[0]);
const output = path.resolve(positional[1] || path.join(path.dirname(input), `${path.basename(input, '.html')}_通用编辑版.html`));
const packageRoot = path.resolve(import.meta.dirname, '..');
const sourceDir = await resolveEditorSource(packageRoot);
const assetDir = path.join(path.dirname(output), 'html-ppt-editor');
let html = await readFile(input, 'utf8');

if (strip) {
  html = html
    .replace(/<aside class="edit-dock"[\s\S]*?<div class="edit-toast"[^>]*>[\s\S]*?<\/div>\s*/i, '')
    .replace(/<script id="pptEditorRuntime">[\s\S]*?<\/script>\s*/i, '');
}

// Some downloaded teaching pages redirect file:// openings back to a vendor site.
// Remove only that narrowly identified wrapper so the local copy remains usable.
html = html.replace(/\s*<!--\s*自动重定向到在线地址[^>]*-->\s*<script>[\s\S]*?window\.location\.protocol\s*===\s*['"]file:['"][\s\S]*?window\.location\.replace\([\s\S]*?<\/script>\s*/i, '\n');

const iframeTemplate = /<iframe\b[^>]*class=["'][^"']*\bcontent-iframe\b[^"']*["'][^>]*\bsrcdoc=/i.test(html) && /(?:&lt;|<)template\b[^>]*class=(?:&quot;|["'])page-data/i.test(html);
html = html
  .replace(/\s*<link[^>]+html-ppt-editor\.css[^>]*>/gi, '')
  .replace(/\s*<style[^>]+data-html-ppt-profile-style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/\s*<script[^>]+html-ppt-editor\.js[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/\s*<script[^>]+html-ppt-frame-adapter\.js[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/\s*<script[^>]+data-html-ppt-profile[^>]*>[\s\S]*?<\/script>/gi, '');

const link = '<link rel="stylesheet" href="html-ppt-editor/html-ppt-editor.css">';
const features = profile === 'full'
  ? { browserDraft: true, exportHtml: true, saveSource: true, pdf: true, pptx: true, visualPptx: true, pageTools: true }
  : { browserDraft: true, exportHtml: true, saveSource: false, pdf: false, pptx: false, visualPptx: false, pageTools: false };
const profileScript = `<script data-html-ppt-profile>window.HTML_PPT_EDITOR_PROFILE=${JSON.stringify(profile)};window.HTML_PPT_EDITOR_CONFIG=Object.assign({},window.HTML_PPT_EDITOR_CONFIG||{},{profile:${JSON.stringify(profile)},features:${JSON.stringify(features)}});</script>`;
const runtime = iframeTemplate
  ? '<script src="html-ppt-editor/html-ppt-editor.js" data-auto-init="false"></script>\n  <script src="html-ppt-editor/html-ppt-frame-adapter.js"></script>'
  : '<script src="html-ppt-editor/html-ppt-editor.js"></script>';
html = html
  .replace(/<\/head>/i, `  ${link}\n</head>`)
  .replace(/<\/body>/i, `  ${profileScript}\n  ${runtime}\n</body>`);

await mkdir(assetDir, { recursive: true });
await Promise.all([
  copyFile(path.join(sourceDir, 'html-ppt-editor.css'), path.join(assetDir, 'html-ppt-editor.css')),
  copyFile(path.join(sourceDir, 'html-ppt-editor.js'), path.join(assetDir, 'html-ppt-editor.js')),
  copyFile(path.join(sourceDir, 'html-ppt-frame-adapter.js'), path.join(assetDir, 'html-ppt-frame-adapter.js'))
]);
await writeFile(output, html, 'utf8');

console.log(JSON.stringify({
  input,
  output,
  assets: assetDir,
  profile,
  features: profile === 'full'
    ? ['edit', 'draft', 'export-html', 'save-source', 'export-pdf', 'export-pptx', 'page-tools']
    : ['edit', 'draft', 'export-html'],
  stripLegacy: strip,
  format: iframeTemplate ? 'iframe-template' : 'standard'
}, null, 2));

async function resolveEditorSource(root) {
  const candidates = [path.join(root, 'editor'), path.join(root, 'assets', 'editor')];
  for (const candidate of candidates) {
    try {
      if ((await stat(path.join(candidate, 'html-ppt-editor.js'))).isFile()) return candidate;
    } catch {}
  }
  fail(`Editor assets not found under ${root}`);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
