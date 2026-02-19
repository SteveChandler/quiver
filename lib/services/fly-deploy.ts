/**
 * Fly.io Machines API helpers for model deployment.
 *
 * Uses the Machines REST API to update machine-level env vars directly.
 * This is required because Fly secrets do NOT override machine-level env
 * vars — they coexist and machine env vars take precedence.
 *
 * @see https://fly.io/docs/machines/api/machines-resource/
 */

const FLY_MACHINES_BASE = 'https://api.machines.dev/v1/apps';

interface MachineConfig {
  env: Record<string, string>;
  [key: string]: unknown;
}

interface Machine {
  id: string;
  state: string;
  config: MachineConfig;
}

interface UpdateResult {
  success: boolean;
  error?: string;
  machinesUpdated: number;
}

function getFlyAuth(): { token: string; appName: string } | null {
  const token = process.env.FLY_API_TOKEN;
  if (!token) return null;
  return {
    token,
    appName: process.env.FLY_APP_NAME || 'quiver-ml',
  };
}

/**
 * Update environment variables on all Fly.io machines for the ML app.
 *
 * @param envUpdates - Key-value pairs to set/overwrite in machine env
 * @param envRemovals - Keys to remove from machine env
 */
export async function updateFlyMachineEnvVars(
  envUpdates: Record<string, string>,
  envRemovals: string[] = []
): Promise<UpdateResult> {
  const auth = getFlyAuth();
  if (!auth) {
    return { success: false, error: 'FLY_API_TOKEN not configured', machinesUpdated: 0 };
  }

  const baseUrl = `${FLY_MACHINES_BASE}/${auth.appName}`;
  const headers = {
    'Authorization': `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  };

  // List all machines
  const listResponse = await fetch(`${baseUrl}/machines`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!listResponse.ok) {
    return {
      success: false,
      error: `Failed to list machines: ${listResponse.status}`,
      machinesUpdated: 0,
    };
  }

  const machinesRaw = await listResponse.json();
  if (!Array.isArray(machinesRaw)) {
    return {
      success: false,
      error: 'Unexpected response from Fly API: machines list is not an array',
      machinesUpdated: 0,
    };
  }

  // Filter out machines in terminal states
  const machines: Machine[] = machinesRaw.filter(
    (m: Machine) => m.state !== 'destroying' && m.state !== 'destroyed'
  );

  let machinesUpdated = 0;
  const errors: string[] = [];

  for (const machine of machines) {
    const machineLabel = `machine ${machine.id} (${machine.state})`;

    // Get current config (list response includes config but refetch for freshness)
    const getResponse = await fetch(`${baseUrl}/machines/${machine.id}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!getResponse.ok) {
      errors.push(`Failed to get ${machineLabel}: ${getResponse.status}`);
      continue;
    }

    const machineData: Machine = await getResponse.json();
    const currentConfig = machineData.config;

    // Build updated env: merge updates, remove deletions
    const updatedEnv = { ...currentConfig.env };
    for (const [key, value] of Object.entries(envUpdates)) {
      updatedEnv[key] = value;
    }
    for (const key of envRemovals) {
      delete updatedEnv[key];
    }

    // Update machine config via POST (Machines API handles stop/restart)
    console.log(`[Fly Deploy] Updating ${machineLabel}...`);
    const updateResponse = await fetch(`${baseUrl}/machines/${machine.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        config: {
          ...currentConfig,
          env: updatedEnv,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      errors.push(`Failed to update ${machineLabel}: ${updateResponse.status} ${errorText}`);
      continue;
    }

    // Wait for machine to reach started state (skip for already-stopped machines)
    if (machineData.state !== 'stopped') {
      try {
        const waitResponse = await fetch(
          `${baseUrl}/machines/${machine.id}/wait?state=started&timeout=60`,
          { headers, signal: AbortSignal.timeout(70000) }
        );
        if (!waitResponse.ok) {
          console.warn(`[Fly Deploy] Wait for ${machineLabel}: ${waitResponse.status}`);
        }
      } catch (e) {
        console.warn(`[Fly Deploy] Wait for ${machineLabel} timed out:`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`[Fly Deploy] ${machineLabel} updated successfully`);
    machinesUpdated++;
  }

  if (machinesUpdated === 0) {
    return {
      success: false,
      error: `No machines updated. Errors: ${errors.join('; ')}`,
      machinesUpdated: 0,
    };
  }

  if (errors.length > 0) {
    console.warn(`[Fly Deploy] ${errors.length} machine(s) had errors: ${errors.join('; ')}`);
  }

  return { success: true, machinesUpdated };
}

/**
 * Poll the ML health endpoint until it reports the expected state.
 *
 * @param expectedVersion - Expected model_version (primary) in health response
 * @param options.expectedCandidateVersion - If set, also verify candidate_version matches
 * @param options.candidateOnly - If true, only check candidate_version (ignore primary)
 */
export async function waitForModelVersion(
  expectedVersion: string,
  options: {
    timeoutMs?: number;
    expectedCandidateVersion?: string;
    candidateOnly?: boolean;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const healthUrl = process.env.ML_SERVICE_URL
    ? `${process.env.ML_SERVICE_URL}/health`
    : 'https://quiver-ml.fly.dev/health';
  const timeout = options.timeoutMs ?? 90000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(healthUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const health = await response.json();

        if (options.candidateOnly) {
          // Only check candidate version (for shadow scoring deployment)
          if (health.candidate_version === expectedVersion) {
            console.log(`[Fly Deploy] Health confirmed candidate version: ${expectedVersion}`);
            return { success: true };
          }
          console.log(`[Fly Deploy] Health: candidate=${health.candidate_version} (want ${expectedVersion})`);
        } else {
          // Check primary model version
          const primaryOk = health.model_version === expectedVersion;
          const candidateOk = !options.expectedCandidateVersion
            || health.candidate_version === options.expectedCandidateVersion;

          if (primaryOk && candidateOk) {
            console.log(`[Fly Deploy] Health confirmed: model=${health.model_version}, candidate=${health.candidate_version}`);
            return { success: true };
          }
          console.log(`[Fly Deploy] Health: model=${health.model_version} (want ${expectedVersion}), candidate=${health.candidate_version}`);
        }
      }
    } catch (e) {
      // Retry on fetch errors (machine restarting)
      console.log(`[Fly Deploy] Health check fetch error: ${e instanceof Error ? e.message : e}`);
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return {
    success: false,
    error: `Health check did not confirm version ${expectedVersion} within ${timeout / 1000}s`,
  };
}
