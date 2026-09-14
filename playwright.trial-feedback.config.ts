import { defineConfig } from '@playwright/test';
import base from './playwright.email-lifecycle.config';
const webServer = base.webServer;
if (!webServer || Array.isArray(webServer)) throw new Error('Expected one local email test server');
export default defineConfig({ ...base, testMatch: 'email-core-loop/trial-feedback.spec.ts', webServer: { ...webServer, env: { ...webServer.env, TRIAL_FEEDBACK_ENABLED: 'true', TRIAL_FEEDBACK_REDEMPTION_ENABLED: 'false', TRIAL_FEEDBACK_WORKER_ENABLED: 'false' } } });
