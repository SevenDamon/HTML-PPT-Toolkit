import {readFile} from 'node:fs/promises';
import {hasEditor} from '../studio/document.mjs';
if(!process.argv[2]){console.error('Usage: node check-editor.mjs <deck.html>');process.exit(2)}
if(!hasEditor(await readFile(process.argv[2],'utf8'))){console.error('此网页未接入共享编辑器。请先使用“快速接入编辑器”，或让 Skill + Agent 适配网页结构，再打开保存与导出。');process.exit(3)}
