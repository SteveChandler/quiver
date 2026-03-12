import type { DeviceInfo } from '@/lib/utils/user-agent-parser';

interface BotFingerprintRule {
  id: string;
  description: string;
  conditions: {
    os?: string;
    browser?: string;
    deviceType?: string;
    viewportWidth?: number;
    isAnonymous: boolean;
  };
}

const BOT_FINGERPRINT_RULES: BotFingerprintRule[] = [
  {
    id: 'windows-chrome-1280-anon',
    description: 'Invariant bot fingerprint: Windows/Chrome/1280px anonymous sessions',
    conditions: { os: 'Windows', browser: 'Chrome', viewportWidth: 1280, isAnonymous: true },
  },
];

/**
 * Check if an event matches a known bot fingerprint pattern.
 * Only filters anonymous sessions matching exact device signatures.
 */
export function isEventBot(
  device: DeviceInfo,
  viewportWidth: number | undefined,
  isAnonymous: boolean
): { isBot: boolean; ruleId?: string } {
  for (const rule of BOT_FINGERPRINT_RULES) {
    const c = rule.conditions;
    if (c.isAnonymous && !isAnonymous) continue;
    if (c.os && device.os !== c.os) continue;
    if (c.browser && device.browser !== c.browser) continue;
    if (c.deviceType && device.device_type !== c.deviceType) continue;
    if (c.viewportWidth !== undefined && viewportWidth !== c.viewportWidth) continue;
    return { isBot: true, ruleId: rule.id };
  }
  return { isBot: false };
}
