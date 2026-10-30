import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const base=path.join(os.homedir(),'.codex/skills/dashiai-ppt/project');
const {chromium}=await import(pathToFileURL(path.join(base,'node_modules/playwright-core/index.mjs')));
const {getExportBrowserPath}=await import(pathToFileURL(path.join(base,'scripts/chrome-path.mjs')));
const browser=await chromium.launch({headless:true,executablePath:getExportBrowserPath()});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(value,message)=>{if(!value)throw Error(message)};
try{
  await page.setContent(`<main aria-live="polite"><div id="deck"><section class="slide active" id="test-slide" style="width:1600px;height:900px;position:relative">
    <h1 data-ppt-editable>Already marked</h1><p id="missing">Missing plain text</p>
    <header data-ppt-protected><span id="course">Course name</span></header>
    <div id="note" data-ppt-protected>Source description</div>
    <button id="demo" data-demo data-ppt-protected>Try demonstration</button>
    <div id="mixed" data-ppt-protected>Caption text <button data-action="zoom">Zoom</button></div>
    <footer data-ppt-protected><span id="number">01</span><i class="progress"></i><span>24</span></footer>
    <nav><button id="next" data-action="next">Next</button></nav>
    <div data-ppt-text-locked><span id="locked">Explicitly locked</span></div>
    <svg><text id="svg-text">Vector label</text></svg>
    <div data-hppt-ui><span id="ui-label">Editor label</span></div>
  </section></div></main>`);
  await page.addStyleTag({path:path.resolve(import.meta.dirname,'../editor/html-ppt-editor.css')});
  await page.addScriptTag({path:path.resolve(import.meta.dirname,'../editor/html-ppt-editor.js')});
  await page.waitForFunction(()=>Boolean(window.__htmlPptEditor));
  await page.evaluate(()=>window.__htmlPptEditor.setEditing(true));
  for(const id of ['missing','course','note','demo'])check(await page.locator('#'+id).evaluate(n=>n.isContentEditable),id+' not editable');
  for(const id of ['number','next','locked','svg-text','ui-label'])check(!await page.locator('#'+id).evaluate(n=>n.isContentEditable||n.hasAttribute('data-hppt-editable')),id+' unexpectedly editable');
  check(await page.locator('#mixed > [data-hppt-editable]').count()===1,'mixed direct text missing');
  check(!await page.locator('#mixed button').evaluate(n=>n.isContentEditable),'nested action unlocked');
  let activated=0;await page.exposeFunction('recordActivation',()=>{activated++});
  await page.evaluate(()=>document.querySelector('#demo').addEventListener('click',()=>window.recordActivation()));
  await page.locator('#demo').click();await page.keyboard.type('EDIT');
  check((await page.locator('#demo').textContent()).includes('EDIT'),'button label cannot be typed');
  check(activated===0,'button activated while editing');
  check(await page.locator('[data-id="remove"]').isDisabled(),'protected label can be deleted');
  await page.evaluate(()=>{const p=document.createElement('p');p.id='dynamic';p.textContent='Added later';document.querySelector('.slide').append(p);window.__htmlPptEditor.refresh()});
  check(await page.locator('#dynamic').evaluate(n=>n.isContentEditable),'new text not editable during editing');
  const before=await page.locator('#test-slide').innerHTML();
  await page.evaluate(()=>{window.__htmlPptEditor.refresh();window.__htmlPptEditor.refresh()});
  check(before===await page.locator('#test-slide').innerHTML(),'discovery not idempotent');
  const keys=await page.locator('[data-hppt-editable]').evaluateAll(ns=>ns.map(n=>n.dataset.hpptKey));
  check(new Set(keys).size===keys.length,'duplicate text keys');
  await page.evaluate(()=>window.__htmlPptEditor.setEditing(false));await page.locator('#demo').click();
  check(activated===1,'button action missing in presentation');check(!errors.length,errors.join('\n'));
  console.log(JSON.stringify({ok:true,partialAnnotations:true,protectedLabels:true,mixedActions:true,navigationLocked:true,dynamicText:true,idempotent:true,uniqueKeys:true,buttonTyping:true,presentationAction:true,errors},null,2));
}finally{await browser.close()}
