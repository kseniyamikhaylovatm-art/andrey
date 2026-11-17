import {defineConfig} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dataDir=mkdtempSync(join(tmpdir(),'mi-espanol-browser-'));
const accountDir=mkdtempSync(join(tmpdir(),'mi-espanol-accounts-browser-'));
export default defineConfig({testDir:'tests/browser',workers:1,use:{baseURL:'http://127.0.0.1:3100',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},webServer:[
  {command:`PORT=3100 DATA_DIR=${dataDir} APP_ACCESS_CODE='' TEACHER_ACCESS_CODE='' npm run dev`,url:'http://127.0.0.1:3100/api/health',reuseExistingServer:false,timeout:30000},
  {command:`PORT=3101 DATA_DIR=${accountDir} APP_ACCESS_CODE=legacy-browser-code TEACHER_ACCESS_CODE=teacher-browser-code-for-tests SESSION_SECRET=browser-test-secret-with-32-characters npm run dev`,url:'http://127.0.0.1:3101/api/health',reuseExistingServer:false,timeout:30000}
],reporter:'list'});
