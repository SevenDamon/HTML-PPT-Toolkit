// Toolkit-owned launcher; does not depend on an installed Agent or Skill.
import os from 'node:os';
import {mkdtemp, rm} from 'node:fs/promises';
import path from 'node:path';
import {getExportBrowserPath} from '../chrome-path.mjs';

export async function launchExportBrowser(chromium, {fallbackTmpDirs = []} = {}) {
  let temp;
  for (const candidate of [os.tmpdir(), ...fallbackTmpDirs]) {
    try {
      const {mkdir} = await import('node:fs/promises');
      await mkdir(candidate, {recursive: true});
      temp = await mkdtemp(path.join(candidate, 'hppt-browser-'));
      break;
    } catch {}
  }
  if (!temp) throw new Error('No writable directory for export browser');
  try {
    const browser = await chromium.launch({headless: true, executablePath: getExportBrowserPath(), env: {...process.env, TMPDIR: temp, TMP: temp, TEMP: temp}});
    browser.on('disconnected', () => { rm(temp, {recursive: true, force: true}).catch(() => {}); });
    return browser;
  } catch (error) {
    await rm(temp, {recursive: true, force: true}).catch(() => {});
    throw error;
  }
}
