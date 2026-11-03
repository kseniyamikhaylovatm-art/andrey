import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dataDir=mkdtempSync(join(tmpdir(),'mi-espanol-browser-'));
export default defineConfig({testDir:'tests/browser',workers:1,use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},webServer:{command:`PORT=3100 DATA_DIR=${dataDir} npm run dev`,url:'http://127.0.0.1:3100/api/health',reuseExistingServer:false,timeout:30000},reporter:'list'});
