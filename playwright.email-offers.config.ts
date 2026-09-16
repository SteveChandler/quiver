import { defineConfig } from '@playwright/test';
import base from './playwright.email-lifecycle.config';
const webServer = base.webServer;
if (!webServer || Array.isArray(webServer)) throw new Error('Expected one local email test server');
export default defineConfig({ ...base, testMatch: 'email-core-loop/owned-offers.spec.ts', webServer: { ...webServer, env: { ...webServer.env, PRO_OFFERS_ENABLED: 'true' } } });
