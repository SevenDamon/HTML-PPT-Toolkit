// Toolkit-owned browser resolver. Third-party conversion code is kept separately.
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {chromium} from 'playwright-core';

export function getExportBrowserPath() {
  const configured = process.env.CHROME_PATH;
  if (configured) {
    if (!existsSync(configured)) throw new Error('CHROME_PATH does not exist');
    return configured;
  }
  const require = createRequire(import.meta.url);
  const registry = JSON.parse(readFileSync(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'browsers.json'), 'utf8'));
  const revision = registry.browsers.find(browser => browser.name === 'chromium-headless-shell').revision;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(chromium.executablePath(), '../../..');
  const folder = process.platform === 'win32' ? 'win64' : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64') : 'linux64';
  const executable = path.join(cache, 'chromium_headless_shell-' + revision, 'chrome-headless-shell-' + folder, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');
  if (!existsSync(executable)) throw new Error('Export browser missing. Install chromium-headless-shell or use the Windows Full release.');
  return executable;
}
