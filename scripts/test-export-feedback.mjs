import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import net from 'node:net';
const root=path.resolve(import.meta.dirname,'..'),portable=path.resolve(process.argv[2]),temp=await mkdtemp(path.join(os.tmpdir(),'hppt-feedback-'));
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(portable,'runtime/browsers');
const {chromium}=await import(pathToFileURL(path.join(portable,'vendor/export-engine/node_modules/playwright-core/index.mjs')));
const {getExportBrowserPath}=await import(pathToFileURL(path.join(portable,'vendor/export-engine/scripts/chrome-path.mjs')));
// A real old SDK proves that opening an existing deck receives the updated editor.
const oldJs=await readFile(path.join(portable,'editor/html-ppt-editor.js'),'utf8'),oldCss=await readFile(path.join(portable,'editor/html-ppt-editor.css'),'utf8');
await mkdir(path.join(temp,'html-ppt-editor'));
await writeFile(path.join(temp,'html-ppt-editor/html-ppt-editor.js'),oldJs);
await writeFile(path.join(temp,'html-ppt-editor/html-ppt-editor.css'),oldCss);
const host='<!doctype html><html><head><meta charset="utf-8"><title>Export feedback QA</title><style>body{margin:0;background:#dce6e2}#deck{margin:50px auto;width:900px;height:506px;background:#fff}.slide{padding:60px}h1{font:40px sans-serif}</style><link rel="stylesheet" href="html-ppt-editor/html-ppt-editor.css"></head><body><main id="deck"><section class="slide active"><h1 data-ppt-editable>导出操作反馈测试</h1></section></main><script>window.HTML_PPT_EDITOR_PROFILE="lite";</script><script src="html-ppt-editor/html-ppt-editor.js"></script></body></html>';
const source=path.join(temp,'sample.html');await writeFile(source,host);
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const server=spawn(process.execPath,[path.join(root,'studio/server.mjs'),'--file',source,'--port',String(port)],{env:{...process.env,HTML_PPT_STUDIO_NO_OPEN:'1'},windowsHide:true,stdio:'pipe'});let logs='',browser;server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break}catch{}await delay(100)}
 browser=await chromium.launch({headless:true,executablePath:getExportBrowserPath()});const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/`);await page.waitForFunction(()=>!!window.__htmlPptEditor);assert.equal(await page.evaluate(()=>HtmlPptEditor.version),'0.16.1');assert.equal(await readFile(source,'utf8'),host);
 await page.evaluate(()=>__htmlPptEditor.setEditing(true));
 let calls=0,payload,release;let gate=new Promise(r=>release=r),fail=false;
 await page.route('**/api/project-export?*',async route=>{calls++;payload=route.request().postDataJSON();await gate;await route.fulfill({status:fail?500:200,contentType:'application/pdf',body:fail?'测试失败：转换引擎忙':'%PDF-test'})});
 const panel=page.locator('.hppt-export-status'),pdf=page.locator('[data-id="pdf"]'),ppt=page.locator('[data-id="pptx"]');
 await pdf.click();await panel.waitFor({state:'visible'});assert.match(await panel.innerText(),/正在导出 PDF/);assert.equal(await pdf.isDisabled(),true);assert.equal(await ppt.isDisabled(),true);
 await page.waitForFunction(()=>document.querySelector('.hppt-export-status small').textContent!=='已等待 0 秒');
 await page.evaluate(()=>{__htmlPptEditor.setEditing(false);__htmlPptEditor.setEditing(true);for(let i=0;i<5;i++){__htmlPptEditor.exportOffice('pdf');__htmlPptEditor.exportOffice('pptx');document.querySelector('[data-id="pdf"]').click()}});
 assert.equal(await pdf.isDisabled(),true);assert.equal(await ppt.isDisabled(),true);assert.equal(calls,1);assert(!payload.html.includes('class="hppt-export-status"'));
 await page.screenshot({path:path.join(temp,'pending-1366.png')});await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(temp,'pending-1920.png')});
 const downloaded=page.waitForEvent('download');release();await downloaded;await page.waitForFunction(()=>document.querySelector('.hppt-export-status').dataset.state==='done');assert.equal(await pdf.isEnabled(),true);assert.equal(await ppt.isEnabled(),true);
 fail=true;gate=new Promise(r=>release=r);await ppt.click();await page.waitForFunction(()=>document.querySelector('.hppt-export-status').dataset.state==='busy');while(calls<2)await delay(25);release();await page.waitForFunction(()=>document.querySelector('.hppt-export-status').dataset.state==='error');assert.match(await panel.innerText(),/转换引擎忙/);assert.equal(await ppt.isEnabled(),true);
 // Custom/iframe export handlers share the same immediate feedback and lock.
 await page.evaluate(()=>{window.handlerCalls=0;__htmlPptEditor.config.officeExportHandler=()=>{handlerCalls++;return new Promise(r=>window.finishHandler=r)}});
 await pdf.click();await page.waitForFunction(()=>window.handlerCalls===1);await page.evaluate(()=>__htmlPptEditor.exportOffice('pptx'));assert.equal(await page.evaluate(()=>handlerCalls),1);assert.equal(await ppt.isDisabled(),true);await page.evaluate(()=>finishHandler());await page.waitForFunction(()=>document.querySelector('.hppt-export-status').dataset.state==='done');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,immediatePersistentFeedback:true,elapsedTime:true,duplicateCallsBlocked:true,controlsStayLockedAfterEditingRefresh:true,failureAllowsRetry:true,customHandlerCovered:true,statusExcludedFromExport:true,oldEditorUpgradedWithoutWritingSource:true,artifacts:temp},null,2));
}catch(e){console.error(logs);throw e}finally{if(browser)await browser.close();server.kill()}
