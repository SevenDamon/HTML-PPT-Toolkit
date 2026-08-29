import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

const toolkitRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(toolkitRoot, 'skill');
const packageRoot = path.join(toolkitRoot, 'skill-package', 'html-ppt-author');
const installRoot = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills', 'html-ppt-author');
const shouldInstall = process.argv.includes('--install');

await assertDirectory(sourceRoot, 'Skill 源目录');
await resetOwnedDirectory(packageRoot, path.join(toolkitRoot, 'skill-package'));
await cp(sourceRoot, packageRoot, { recursive: true });

await copyFile('editor/html-ppt-editor.js', 'assets/editor/html-ppt-editor.js');
await copyFile('editor/html-ppt-editor.css', 'assets/editor/html-ppt-editor.css');
await copyFile('editor/html-ppt-frame-adapter.js', 'assets/editor/html-ppt-frame-adapter.js');
await copyFile('scripts/install-editor.mjs', 'scripts/install-editor.mjs');
await copyFile('scripts/check-deck.mjs', 'scripts/check-deck.mjs');

const packageJson = JSON.parse(await readFile(path.join(toolkitRoot, 'package.json'), 'utf8'));
const editorText = await readFile(path.join(toolkitRoot, 'editor', 'html-ppt-editor.js'), 'utf8');
const editorVersion = editorText.match(/version\s*:\s*['"]([^'"]+)['"]/)?.[1] || packageJson.version;
const files = await hashTree(packageRoot, new Set(['package-manifest.json']));
const manifest = {
  name: 'html-ppt-author',
  generatedFrom: 'html-ppt-toolkit',
  toolkitVersion: packageJson.version,
  editorVersion,
  generatedAt: new Date().toISOString(),
  files
};
await writeFile(path.join(packageRoot, 'package-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

let installed = false;
if (shouldInstall) {
  await resetOwnedDirectory(installRoot, path.join(path.dirname(installRoot)));
  await cp(packageRoot, installRoot, { recursive: true });
  const installedFiles = await hashTree(installRoot, new Set(['package-manifest.json']));
  if (JSON.stringify(files) !== JSON.stringify(installedFiles)) {
    throw new Error('Skill 安装后的文件哈希与构建包不一致。');
  }
  installed = true;
}

console.log(JSON.stringify({
  ok: true,
  toolkitVersion: packageJson.version,
  editorVersion,
  packageRoot,
  installed,
  installRoot: installed ? installRoot : null,
  verifiedFiles: Object.keys(files).length
}, null, 2));

async function copyFile(from, to) {
  const target = path.join(packageRoot, ...to.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(toolkitRoot, ...from.split('/')), target);
}

async function resetOwnedDirectory(target, expectedParent) {
  const resolved = path.resolve(target);
  const parent = path.resolve(expectedParent);
  if (path.basename(resolved) !== 'html-ppt-author' || path.dirname(resolved) !== parent) {
    throw new Error(`拒绝清理非预期目录：${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
}

async function assertDirectory(target, label) {
  const info = await stat(target).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`${label}不存在：${target}`);
}

async function hashTree(root, excluded) {
  const result = {};
  for (const relative of await listFiles(root)) {
    if (excluded.has(relative)) continue;
    const buffer = await readFile(path.join(root, ...relative.split('/')));
    result[relative] = createHash('sha256').update(buffer).digest('hex');
  }
  return result;
}

async function listFiles(root, relative = '') {
  const directory = path.join(root, ...relative.split('/').filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}
