import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const root=path.resolve(import.meta.dirname,'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'hppt-standalone-'));
const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const env={...process.env,USERPROFILE:temp,PATH:path.dirname(process.execPath)+path.delimiter+path.join(process.env.SystemRoot,'System32'),HTML_PPT_STUDIO_NO_OPEN:'1'};
const ps=code=>spawnSync(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',code],{env,encoding:'utf8',windowsHide:true,timeout:20000});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const resolved=ps(`$a=[Reflection.Assembly]::LoadFile(${quote(path.join(root,'HTML-PPT-Toolkit.exe'))});$t=$a.GetType('HtmlPptToolkitLauncher.ToolkitForm');$m=$t.GetMethod('ResolvePwsh',[Reflection.BindingFlags]'NonPublic,Static');[Console]::Write($m.Invoke($null,@()))`);
assert.equal(resolved.status,0,resolved.stderr);assert.equal(resolved.stdout.toLowerCase(),powershell.toLowerCase());
for(const file of ['convert-html.ps1','start-studio.ps1','build-and-sync-skill.ps1']){const b=await readFile(path.join(root,file));assert.deepEqual([...b.subarray(0,3)],[239,187,191]);const parse=ps(`$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile(${quote(path.join(root,file))},[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|Out-String|Write-Error;exit 1}`);assert.equal(parse.status,0,parse.stderr)}
const input=path.join(temp,'demo with spaces.html');const demo=(await readFile(path.join(root,'examples/demo.html'),'utf8')).replace(/\s*<link[^>]+html-ppt-editor\.css[^>]*>/gi,'').replace(/\s*<script[^>]+html-ppt-editor\.js[^>]*><\/script>/gi,'');await writeFile(input,demo);
const converted=spawnSync(powershell,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(root,'convert-html.ps1'),input],{env,input:'N\n\n',encoding:'utf8',windowsHide:true,timeout:25000});assert.equal(converted.status,0,converted.stderr||converted.error?.message);
const output=path.join(temp,'demo with spaces_通用编辑版.html');assert.match(await readFile(output,'utf8'),/HTML_PPT_EDITOR_PROFILE="full"/);
const probe=await import('node:net');const listener=probe.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const server=spawn(powershell,['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(root,'start-studio.ps1'),input],{env:{...env,HTML_PPT_STUDIO_PORT:String(port)},stdio:'pipe',windowsHide:true});let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
try{let response;for(let i=0;i<60;i++){try{response=await fetch(`http://127.0.0.1:${port}/`);break}catch{await delay(100)}}assert.ok(response?.ok,logs);assert.match(await response.text(),/__hppt\/editor.js/);const saved=await fetch(`http://127.0.0.1:${port}/api/save-source`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({html:'<!doctype html><title>Saved independently</title>'})});assert.ok(saved.ok);assert.match(await readFile(input,'utf8'),/Saved independently/)}finally{spawnSync(path.join(process.env.SystemRoot,'System32/taskkill.exe'),['/pid',String(server.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'})}
console.log(JSON.stringify({ok:true,noCodexProfile:true,noPowerShell7InPath:true,builtInFallback:true,windowsPowerShellParsing:true,unicodeScriptEncoding:true,conversion:true,studio:true,saveSource:true},null,2));
