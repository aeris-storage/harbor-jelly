import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--enable-unsafe-webgpu',
        '--enable-features=WebGPU',
        '--use-angle=metal',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
      ]
    }
  },
  outputDir: 'test-results'
});
