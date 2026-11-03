import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createReadStream, statSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args=parseArgs(process.argv.slice(2));
if(!args.file){console.error('Usage: node studio/server.mjs --file <deck.html> [--port 5537]');process.exit(2)}
const sourceFile=path.resolve(args.file),sourceDir=path.dirname(sourceFile),projectRoot=await findProjectRoot(sourceDir),relativeSource=path.relative(projectRoot,sourceFile).split(path.sep).join('/'),port=Number(args.port||process.env.HTML_PPT_STUDIO_PORT||5537),host='127.0.0.1';
const toolkitRoot=path.resolve(import.meta.dirname,'..'),editorJs=path.join(toolkitRoot,'editor','html-ppt-editor.js'),editorCss=path.join(toolkitRoot,'editor','html-ppt-editor.css'),exportDir=path.join(sourceDir,'导出');
const portableBrowsers=path.join(toolkitRoot,'runtime','browsers');if(requireStat(path.join(toolkitRoot,'runtime','browser-bundled.marker')))process.env.PLAYWRIGHT_BROWSERS_PATH=portableBrowsers;
await stat(sourceFile);await mkdir(exportDir,{recursive:true});

const server=http.createServer(async(req,res)=>{try{var u=new URL(req.url||'/',`http://${host}:${port}`);if(req.method==='POST'&&u.pathname==='/api/project-export')return await exportDeck(req,res,u.searchParams.get('format'));if(req.method==='POST'&&u.pathname==='/api/save-source')return await saveSource(req,res);if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'Method not allowed');if(u.pathname==='/')return redirect(res,'/'+encodePath(relativeSource));if(u.pathname==='/__hppt/editor.js')return fileResponse(req,res,editorJs,'text/javascript;charset=utf-8');if(u.pathname==='/__hppt/editor.css')return fileResponse(req,res,editorCss,'text/css;charset=utf-8');var requested=resolveStatic(u.pathname);if(!requested)return send(res,403,'Forbidden');if(path.resolve(requested)===sourceFile)return serveInjected(req,res);return fileResponse(req,res,requested,mime(requested))}catch(e){console.error(e);send(res,500,e?.message||String(e))}});
server.listen(port,host,()=>{var url=`http://${host}:${port}/${encodePath(relativeSource)}`;console.log(`HTML PPT 工作台：${url}`);console.log(`项目根目录：${projectRoot}`);console.log('关闭此窗口会停止源文件保存及 PDF/PPTX 导出。');if(process.platform==='win32'&&process.env.HTML_PPT_STUDIO_NO_OPEN!=='1')spawn('cmd.exe',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true}).unref()});

async function serveInjected(req,res){var html=await readFile(sourceFile,'utf8'),hasProfile=/data-html-ppt-profile|HTML_PPT_EDITOR_PROFILE/.test(html),hasEditor=/html-ppt-editor\.js|id=["']editDock["']/.test(html);if(!hasProfile){html=html.replace(/<\/head>/i,'  <script data-hppt-injected>window.HTML_PPT_EDITOR_PROFILE="full";window.HTML_PPT_EDITOR_CONFIG=Object.assign({},window.HTML_PPT_EDITOR_CONFIG,{profile:"full"});</script>\n</head>')}if(!hasEditor){html=html.replace(/<\/head>/i,'  <link rel="stylesheet" href="/__hppt/editor.css" data-hppt-injected>\n</head>').replace(/<\/body>/i,'  <script src="/__hppt/editor.js" data-hppt-injected></script>\n</body>')}var body=Buffer.from(html);res.writeHead(200,{'content-type':'text/html;charset=utf-8','content-length':body.length,'cache-control':'no-store'});if(req.method==='HEAD')return res.end();res.end(body)}
async function saveSource(req,res){var payload=JSON.parse(await body(req,64*1024*1024));if(typeof payload.html!=='string')return send(res,400,'缺少 HTML');var backup=sourceFile+'.bak-'+stamp();await copyFile(sourceFile,backup);await writeFile(sourceFile,payload.html,'utf8');sendJson(res,{ok:true,file:sourceFile,backup:backup})}
async function exportDeck(req,res,format){if(format!=='pdf'&&format!=='pptx')return send(res,400,'format 只能是 pdf 或 pptx');var payload=JSON.parse(await body(req,64*1024*1024));if(typeof payload.html!=='string')return send(res,400,'缺少 HTML 快照');var token=randomUUID().replaceAll('-',''),tempFile=path.join(sourceDir,`__hppt-export-${token}.html`),outFile=path.join(exportDir,`${safe(payload.fileName||path.basename(sourceFile,'.html'))}_${stamp()}.${format}`),browser;try{await writeFile(tempFile,prepareExportHtml(payload.html),'utf8');var dashi=resolveDashiProject(),[{chromium},{launchExportBrowser}]=await Promise.all([import(pathToFileURL(path.join(dashi,'node_modules','playwright-core','index.mjs')).href),import(pathToFileURL(path.join(dashi,'scripts','preview','launch-export-browser.mjs')).href)]);browser=await launchExportBrowser(chromium,{fallbackTmpDirs:[path.join(exportDir,'.browser-tmp')],log:m=>console.warn(m)});var tempRel=path.relative(projectRoot,tempFile).split(path.sep).join('/'),url=`http://${host}:${port}/${encodePath(tempRel)}?static=1`;if(format==='pptx'){var report=outFile.replace(/\.pptx$/i,'.json'),result;if(payload.exportMode==='screenshot'){result=await exportScreenshotPptx(browser,url,{outFile:outFile,reportFile:report,title:payload.title||'HTML PPT',dashi:dashi});console.log(`PPTX ${result.slideCount}页｜整页视觉模式`)}else{var{exportEditablePptxFromUrl}=await import(pathToFileURL(path.join(dashi,'packages','html-deck-to-pptx','src','editable.mjs')).href);result=await exportEditablePptxFromUrl(browser,url,{outFile:outFile,reportFile:report,title:payload.title||'HTML PPT'});console.log(`PPTX ${result.slideCount}页｜可编辑文字${result.textObjects}｜形状${result.shapeObjects}`)}}else{var{exportScreenshotPdfFromUrl}=await import(pathToFileURL(path.join(dashi,'packages','html-deck-to-pptx','src','screenshot.mjs')).href);await exportScreenshotPdfFromUrl(browser,url,{outFile:outFile,title:payload.title||'HTML PPT'})}return download(res,outFile,format)}catch(e){console.error(e);send(res,500,'导出失败：'+(e?.message||e))}finally{if(browser)await browser.close().catch(()=>{});await rm(tempFile,{force:true}).catch(()=>{})}}

function prepareExportHtml(html){
  if(!/data-runtime=["']wise-ppt-deck["']/i.test(html))return html;
  html=html
    .replace(/\s*<script[^>]+html-ppt-editor\.js[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/\s*<script[^>]+data-html-ppt-profile[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/\s*<script[^>]+runtime\/(?:deck-runtime|stage-fit|component-behavior)\.js[^>]*>[\s\S]*?<\/script>/gi,'');
  var adapter=`
<style data-hppt-wise-export>
html,body{width:100%!important;height:100%!important;margin:0!important;overflow:hidden!important;background:#fff!important}
body>#board,#presentation-controls,.hppt-dock,.hppt-toast,.hppt-palette,.hppt-shape-palette{display:none!important}
#deck[data-hppt-export-normalized="wise-ppt"]{position:relative!important;inset:auto!important;width:1920px!important;height:1080px!important;margin:0!important;transform:none!important;overflow:hidden!important}
#deck[data-hppt-export-normalized="wise-ppt"]>.hppt-wise-export-slide{position:absolute!important;inset:0!important;display:none!important;width:1920px!important;height:1080px!important;margin:0!important;transform:none!important;box-sizing:border-box!important}
#deck[data-hppt-export-normalized="wise-ppt"]>.hppt-wise-export-slide.active{display:block!important}
</style>
<script data-hppt-wise-export>
(function(){
  function normalize(){
    var deck=document.getElementById('deck'),track=document.getElementById('track');
    if(!deck||!track||deck.dataset.hpptExportNormalized)return;
    var source=Array.from(track.children).filter(function(node){return node.classList&&node.classList.contains('slide')});
    if(!source.length)return;
    var slides=source.map(function(node,index){
      var clone=node.cloneNode(true);clone.classList.add('hppt-wise-export-slide');clone.classList.toggle('active',index===0);
      if(index===0)clone.setAttribute('data-deck-active','');else clone.removeAttribute('data-deck-active');
      return clone;
    });
    var stage=document.getElementById('deck-stage');if(stage)stage.remove();
    var controls=document.getElementById('presentation-controls');if(controls)controls.remove();
    slides.forEach(function(slide){deck.appendChild(slide)});deck.dataset.hpptExportNormalized='wise-ppt';
    window.__getVisibleSlides=function(){return slides.slice()};
    window.go=function(index){var next=Math.max(0,Math.min(slides.length-1,Number(index)||0));slides.forEach(function(slide,i){var active=i===next;slide.classList.toggle('active',active);if(active)slide.setAttribute('data-deck-active','');else slide.removeAttribute('data-deck-active')});return next};
    window.go(0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
})();
</script>`;
  return html.replace(/<\/body>/i,adapter+'\n</body>');
}

async function exportScreenshotPptx(browser,url,options){var context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,ignoreHTTPSErrors:true}),page=await context.newPage();try{page.setDefaultTimeout(90000);await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForSelector('#deck > .slide.active');await page.waitForTimeout(1800);var count=await page.evaluate(()=>{var slides=window.__getVisibleSlides?.()||[...document.querySelectorAll('#deck > .slide')];return slides.length}),module=await import(pathToFileURL(path.join(options.dashi,'node_modules','pptxgenjs','dist','pptxgen.es.js')).href),PptxGenJS=module.default,pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='HTML PPT Toolkit';pptx.subject='Iframe template visual export';pptx.title=options.title||'HTML PPT';pptx.company='HTML PPT Toolkit';for(var i=0;i<count;i++){await page.evaluate(index=>{window.go?.(index);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))},i);await page.waitForTimeout(i===0?600:180);var buffer=await page.locator('#deck > .slide.active').screenshot({type:'png',animations:'disabled',timeout:90000}),slide=pptx.addSlide();slide.background={color:'FFFFFF'};slide.addImage({data:'data:image/png;base64,'+buffer.toString('base64'),x:0,y:0,w:13.333,h:7.5})}await pptx.writeFile({fileName:options.outFile});var result={slideCount:count,textObjects:0,shapeObjects:0,screenshot:true};if(options.reportFile)await writeFile(options.reportFile,JSON.stringify(result,null,2)+'\n','utf8');return result}finally{await page.close().catch(()=>{});await context.close().catch(()=>{})}}

function resolveDashiProject(){var candidates=[process.env.DASHI_PPT_PROJECT,path.join(toolkitRoot,'vendor','export-engine'),path.join(os.homedir(),'.codex','skills','dashiai-ppt','project')].filter(Boolean);for(var p of candidates){try{if(requireStat(path.join(p,'packages','html-deck-to-pptx','src','editable.mjs')))return p}catch{}}throw new Error('未找到 PDF/PPTX 转换引擎；请使用包含 vendor/export-engine 的导出完整版，或设置 DASHI_PPT_PROJECT')}
function requireStat(file){try{return statSync(file).isFile()}catch{return false}}
async function findProjectRoot(start){var current=start;while(true){for(var marker of ['.html-ppt-root','AGENTS.md']){try{if((await stat(path.join(current,marker))).isFile())return current}catch{}}try{var entries=await Promise.all(['slides','assets'].map(async n=>(await stat(path.join(current,n))).isDirectory()));if(entries.every(Boolean))return current}catch{}var parent=path.dirname(current);if(parent===current)return start;current=parent}}
function resolveStatic(urlPath){var decoded;try{decoded=decodeURIComponent(urlPath)}catch{return null}var file=path.resolve(projectRoot,'.'+decoded);return file===projectRoot||file.startsWith(projectRoot+path.sep)?file:null}
async function fileResponse(req,res,file,type){try{var s=await stat(file);if(!s.isFile())return send(res,404,'Not found');res.writeHead(200,{'content-type':type,'content-length':s.size,'cache-control':'no-store'});if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res)}catch{return send(res,404,'Not found')}}
async function download(res,file,format){var s=await stat(file);res.writeHead(200,{'content-type':format==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/pdf','content-length':s.size,'content-disposition':`attachment; filename="presentation.${format}"`,'cache-control':'no-store'});createReadStream(file).pipe(res)}
function body(req,limit){return new Promise((resolve,reject)=>{var chunks=[],size=0;req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('请求超过64MB'));req.destroy()}else chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject)})}
function redirect(res,to){res.writeHead(302,{location:to,'cache-control':'no-store'});res.end()}function send(res,status,message){if(res.headersSent)return res.end();var b=Buffer.from(String(message));res.writeHead(status,{'content-type':'text/plain;charset=utf-8','content-length':b.length,'cache-control':'no-store'});res.end(b)}function sendJson(res,value){var b=Buffer.from(JSON.stringify(value));res.writeHead(200,{'content-type':'application/json;charset=utf-8','content-length':b.length,'cache-control':'no-store'});res.end(b)}
function parseArgs(argv){var out={};for(var i=0;i<argv.length;i++){if(argv[i]==='--file')out.file=argv[++i];else if(argv[i]==='--port')out.port=argv[++i]}return out}function encodePath(p){return p.split('/').map(encodeURIComponent).join('/')}function safe(v){return String(v).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,90)||'presentation'}function stamp(){var d=new Date();return`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}function pad(v){return String(v).padStart(2,'0')}function mime(file){return({'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4'})[path.extname(file).toLowerCase()]||'application/octet-stream'}
