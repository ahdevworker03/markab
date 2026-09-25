import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

if (!executablePath) {
  throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE is required');
}

const workerSource = await readFile(new URL('../dist/public/sw.js', import.meta.url), 'utf8');
if (
  workerSource.includes('__PRECACHE_MANIFEST__') ||
  !/assets\/[^"']+\.js/.test(workerSource) ||
  !/assets\/[^"']+\.css/.test(workerSource)
) {
  throw new Error('The production worker is missing its hashed asset precache manifest');
}

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Could not allocate a loopback port'));
      return;
    }
    probe.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const origin = `http://127.0.0.1:${port}`;

const server = spawn(
  'pnpm',
  [
    '--filter',
    '@workspace/web',
    'exec',
    'vite',
    'preview',
    '--config',
    'vite.config.ts',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { stdio: 'inherit' },
);

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) break;
    } catch {
      // Vite has not bound the preview port yet.
    }

    if (attempt === 29) throw new Error('Vite preview did not start');
    await sleep(250);
  }

  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.goto(`${origin}/offline-shell`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => document.getElementById('root')?.childElementCount !== 0,
    );
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
}
