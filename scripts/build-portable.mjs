import path from 'node:path';
import os from 'node:os';
import {cp,mkdir,readFile,writeFile,stat,readdir,unlink,rmdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const output=path.resolve(process.argv[2]||path.join(root,'..','工具箱分发',`HTML-PPT-Toolkit-v${version}-导出完整版`));
if(await stat(output).catch(()=>false))throw Error('输出目录已存在，请选择新目录，避免覆盖。');
const source=path.resolve(process.env.DASHI_PPT_PROJECT||path.join(os.homedir(),'.codex/skills/dashiai-ppt/project'));
await mkdir(output,{recursive:true});
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of files){if(/^(runtime|vendor)\//.test(file))continue;await cp(path.join(root,file),path.join(output,file),{recursive:true})}
const engine=path.join(output,'vendor/export-engine');
await cp(path.join(source,'packages/html-deck-to-pptx/src'),path.join(engine,'packages/html-deck-to-pptx/src'),{recursive:true});
for(const file of ['chrome-path.mjs','preview/launch-export-browser.mjs','preview/ensure-tmpdir.mjs'])await cp(path.join(source,'scripts',file),path.join(engine,'scripts',file));
const needed=new Set();async function dependency(name){if(needed.has(name))return;needed.add(name);const dir=path.join(source,'node_modules',name),pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));await cp(dir,path.join(engine,'node_modules',name),{recursive:true});for(const name of Object.keys(pkg.dependencies||{}))await dependency(name);for(const name of Object.keys(pkg.optionalDependencies||{})){if(await stat(path.join(source,'node_modules',name)).catch(()=>false))await dependency(name)}}
const direct=['playwright-core','pptxgenjs','pdf-lib','pngjs'];for(const name of direct)await dependency(name);
const dependencies={};for(const name of direct)dependencies[name]=JSON.parse(await readFile(path.join(source,'node_modules',name,'package.json'),'utf8')).version;
await writeFile(path.join(engine,'package.json'),JSON.stringify({name:'html-ppt-export-runtime',private:true,type:'module',dependencies},null,2));
await mkdir(path.join(output,'runtime/node'),{recursive:true});await cp(process.execPath,path.join(output,'runtime/node/node.exe'));
let nodeLicense;if(process.env.NODE_LICENSE_FILE)nodeLicense=await readFile(process.env.NODE_LICENSE_FILE,'utf8');else{const response=await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);if(!response.ok)throw Error('无法获取 Node.js LICENSE');nodeLicense=await response.text()}if(!nodeLicense.includes('Permission is hereby granted'))throw Error('Node.js LICENSE 内容异常');await writeFile(path.join(output,'runtime/node/LICENSE'),nodeLicense);
const browserDir=path.join(output,'runtime/browsers');if(process.env.PORTABLE_BROWSER_DIR)await cp(path.resolve(process.env.PORTABLE_BROWSER_DIR),browserDir,{recursive:true});else execFileSync(process.execPath,[path.join(engine,'node_modules/playwright-core/cli.js'),'install','chromium-headless-shell'],{env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:browserDir},stdio:'inherit'});await writeFile(path.join(output,'runtime/browser-bundled.marker'),'playwright chromium-headless-shell\n');
// Playwright installation links contain the build machine's absolute path, not runtime assets.
const links=path.join(browserDir,'.links');if(await stat(links).catch(()=>false)){for(const name of await readdir(links))await unlink(path.join(links,name));await rmdir(links)}
await writeFile(path.join(output,'PORTABLE-INFO.json'),JSON.stringify({toolkitVersion:version,platform:process.platform,arch:process.arch,node:process.version,engineSource:'DashiAI PPT local export runtime',engineDependencies:dependencies,dependencyPackages:[...needed].sort(),browser:'Bundled Playwright Chromium headless shell for PDF/PPTX export; any normal browser can open the editor UI.'},null,2));
console.log(JSON.stringify({output,version,node:process.version,dependencyPackages:needed.size,includesExportEngine:true,includesNode:true},null,2));
