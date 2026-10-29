/** @jest-environment node */
import { createContextLogger } from '@/lib/logger';

const ORIGINAL = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, LOG_LEVEL: process.env.LOG_LEVEL };

function setEnv(env: { NODE_ENV?: string; VERCEL_ENV?: string; LOG_LEVEL?: string }): void {
  for (const key of ['NODE_ENV', 'VERCEL_ENV', 'LOG_LEVEL'] as const) {
    if (env[key] === undefined) delete (process.env as Record<string, string | undefined>)[key];
    else Object.assign(process.env, { [key]: env[key] });
  }
}

function emitted(env: { NODE_ENV?: string; VERCEL_ENV?: string; LOG_LEVEL?: string }): string[] {
  setEnv(env);
  const calls: string[] = [];
  const spies = [
    jest.spyOn(console, 'log').mockImplementation(() => { calls.push('debug'); }),
    jest.spyOn(console, 'info').mockImplementation(() => { calls.push('info'); }),
    jest.spyOn(console, 'warn').mockImplementation(() => { calls.push('warn'); }),
    jest.spyOn(console, 'error').mockImplementation(() => { calls.push('error'); }),
  ];
  const log = createContextLogger('LevelTest');
  log.debug('d');
  log.info('i');
  log.warn('w');
  log.error('e');
  spies.forEach((spy) => spy.mockRestore());
  return calls;
}

describe('logger levels by environment', () => {
  afterEach(() => setEnv(ORIGINAL));

  it('keeps every level in local development and tests', () => {
    expect(emitted({ NODE_ENV: 'development' })).toEqual(['debug', 'info', 'warn', 'error']);
    expect(emitted({ NODE_ENV: 'test' })).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('drops debug on a deployed preview build but keeps info', () => {
    expect(emitted({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toEqual(['info', 'warn', 'error']);
  });

  it('keeps only warn and error in production', () => {
    expect(emitted({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).toEqual(['warn', 'error']);
    expect(emitted({ NODE_ENV: 'production' })).toEqual(['warn', 'error']);
  });

  it('lets LOG_LEVEL override the environment default', () => {
    expect(emitted({ NODE_ENV: 'production', VERCEL_ENV: 'preview', LOG_LEVEL: 'debug' })).toEqual(['debug', 'info', 'warn', 'error']);
  });
});
