import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ProdReadonlyAuthStatus = {
  reason?: string;
  status: 'blocked' | 'ok';
  updatedAt: string;
};

const AUTH_STATUS_PATH = path.join(
  process.cwd(),
  'e2e',
  '.auth',
  'prod-readonly-auth-status.json'
);

export function isProdReadonlyMode(): boolean {
  return process.env.PLAYWRIGHT_PROD_READONLY === 'true';
}

export async function clearProdReadonlyAuthStatus(): Promise<void> {
  await rm(AUTH_STATUS_PATH, { force: true });
}

export async function writeProdReadonlyAuthStatus(
  status: ProdReadonlyAuthStatus['status'],
  reason?: string
): Promise<void> {
  await mkdir(path.dirname(AUTH_STATUS_PATH), { recursive: true });
  await writeFile(
    AUTH_STATUS_PATH,
    JSON.stringify(
      {
        reason,
        status,
        updatedAt: new Date().toISOString(),
      } satisfies ProdReadonlyAuthStatus,
      null,
      2
    )
  );
}

export function readProdReadonlyAuthStatus(): ProdReadonlyAuthStatus | null {
  if (!existsSync(AUTH_STATUS_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(AUTH_STATUS_PATH, 'utf8')) as ProdReadonlyAuthStatus;
  } catch {
    return null;
  }
}

export function getProdReadonlyAuthBlockReason(): string | null {
  if (!isProdReadonlyMode()) {
    return null;
  }

  const status = readProdReadonlyAuthStatus();
  if (status?.status !== 'blocked') {
    return null;
  }

  return status.reason ?? 'Auth bootstrap failed for the prod-readonly review run.';
}
