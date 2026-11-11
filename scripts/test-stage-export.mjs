import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {spawn, execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import net from 'node:net';
import {normalizeExportDeck} from '../studio/export-adapter.mjs';
import {prepareVisualAssets} from '../studio/visual-assets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const portable = path.resolve(process.argv[2]);
const engine = path.join(portable, 'vendor/export-engine');
const temp = await mkdtemp(path.join(os.tmpdir(), 'hppt-stage-export-'));
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(portable, 'runtime/browsers');
const {chromium} = await import(pathToFileURL(path.join(engine, 'node_modules/playwright-core/index.mjs')));
const {getExportBrowserPath} = await import(pathToFileURL(path.join(engine, 'scripts/chrome-path.mjs')));
const require = createRequire(path.join(engine, 'package.json'));
const {PDFDocument} = require('pdf-lib');
const JSZip = require('jszip');
const {PNG} = require('pngjs');
const source = process.argv[3] ? path.resolve(process.argv[3]) : path.join(temp, 'stage.html');
if (!process.argv[3]) {
  await writeFile(source, `<!doctype html><html><head><style>body{margin:0}#stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;transform:scale(.8)}.slide{position:absolute;width:1600px;height:900px;background:#fff}h1{font:60px sans-serif;margin:80px}p{font:36px sans-serif;margin:80px}</style></head><body><main id="stage" data-ppt-deck><section class="slide active"><h1>Stage first page</h1></section><section class="slide" style="display:none"><h1>Stage second page</h1><p>Editable text retained</p></section></main><script>window.__getVisibleSlides=()=>[...document.querySelectorAll('#stage>.slide')];window.go=i=>__getVisibleSlides().forEach((s,n)=>{s.style.display=n===i?'block':'none';s.classList.toggle('active',n===i)});</script></body></html>`);
  execFileSync(process.execPath, [path.join(root, 'scripts/install-editor.mjs'), source, source, '--profile', 'lite']);
}
const original = await readFile(source);
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const server = spawn(process.execPath, [path.join(root, 'studio/server.mjs'), '--file', source, '--port', String(port)], {
  env: {...process.env, HTML_PPT_STUDIO_NO_OPEN: '1', DASHI_PPT_PROJECT: engine}, windowsHide: true, stdio: 'pipe'
});
let logs = '', browser;
server.stdout.on('data', data => { logs += data; });
server.stderr.on('data', data => { logs += data; });
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch {}
    await delay(100);
  }
  browser = await chromium.launch({headless: true, executablePath: getExportBrowserPath()});
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => !!window.__htmlPptEditor);
  const count = await page.evaluate(() => window.__getVisibleSlides().length);
  await page.evaluate(() => window.__htmlPptEditor.setEditing(true));
  let snapshot;
  page.on('request', request => {
    if (request.url().includes('/api/project-export')) snapshot = request.postDataJSON().html;
  });
  for (const format of ['pptx', 'pdf']) {
    const download = page.waitForEvent('download', {timeout: 240000});
    const failure = page.waitForFunction(() => document.querySelector('.hppt-export-status')?.dataset.state === 'error', null, {timeout: 240000})
      .then(async () => { throw Error(await page.locator('.hppt-export-status').innerText()); });
    await page.locator('[data-id="' + format + '"]').click();
    const result = await Promise.race([download, failure]);
    const output = path.join(temp, 'result.' + format);
    await result.saveAs(output);
    if (format === 'pdf') assert.equal((await PDFDocument.load(await readFile(output))).getPageCount(), count);
    else {
      const zip = await JSZip.loadAsync(await readFile(output));
      const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
      assert.equal(slides.length, count);
      const text = await zip.file(slides[1]).async('string');
      assert(text.includes('<a:t>'), 'PPTX has no editable text');
    }
    console.log(format + ': ' + count + ' pages passed');
  }
  await page.route('**/__qa-normalized.html', route => route.fulfill({contentType: 'text/html', body: snapshot.replace('</body>', '<script>(' + normalizeExportDeck.toString() + ')()</script></body>')}));
  await page.goto(new URL('__qa-normalized.html', page.url()).href);
  await page.waitForSelector('#deck > .slide.active');
  assert.equal(await page.locator('#deck > .slide').count(), count);
  const bounds = await page.locator('#deck > .slide.active').boundingBox();
  assert(Math.abs(bounds.width - 1920) < 0.5);
  assert(Math.abs(bounds.height - 1080) < 0.5);
  await page.screenshot({path: path.join(temp, 'normalized-cover.png')});
  const before = PNG.sync.read(await page.screenshot());
  await prepareVisualAssets(page);
  const after = PNG.sync.read(await page.screenshot({path: path.join(temp, 'baked-cover.png')}));
  let changed = 0;
  for (let pixel = 0; pixel < before.data.length; pixel += 4) {
    if ([0, 1, 2].some(channel => Math.abs(before.data[pixel + channel] - after.data[pixel + channel]) > 8)) changed++;
  }
  const changedRatio = changed / (before.width * before.height);
  assert(changedRatio < 0.005, 'Image baking changed the rendered cover: ' + changedRatio);
  const zip = await JSZip.loadAsync(await readFile(path.join(temp, 'result.pptx')));
  const media = await Promise.all(Object.keys(zip.files).filter(name => /^ppt\/media\//.test(name) && !zip.files[name].dir).map(name => zip.file(name).async('nodebuffer')));
  const baked = await page.locator('[data-hppt-visual-baked]').first().count();
  if (baked) {
    const url = await page.locator('[data-hppt-visual-baked]').first().evaluate(node => node.style.backgroundImage);
    const bytes = Buffer.from(url.match(/base64,([^"\)]+)/)[1], 'base64');
    const expected = PNG.sync.read(bytes);
    await writeFile(path.join(temp, 'expected-photo.png'), bytes);
    const matched = media.some(image => {
      let actual;
      try { actual = PNG.sync.read(image); } catch { return false; }
      if (actual.width !== expected.width || actual.height !== expected.height) return false;
      let different = 0;
      for (let pixel = 0; pixel < expected.data.length; pixel += 4) {
        if ([0, 1, 2].some(channel => Math.abs(actual.data[pixel + channel] - expected.data[pixel + channel]) > 8)) different++;
      }
      return different / (expected.width * expected.height) < 0.005;
    });
    assert(matched, 'Baked visual missing from PPTX media');
  }
  console.log('Cover pixel comparison passed: changed ratio ' + changedRatio);
  assert((await readFile(source)).equals(original), 'Source HTML changed');
  console.log(JSON.stringify({ok: true, count, sourcePreserved: true, editableText: true, artifacts: temp}));
} catch (error) { console.error(logs); throw error; }
finally { if (browser) await browser.close(); server.kill(); }
