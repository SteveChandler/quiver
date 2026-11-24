const ALERT_EMAIL_GATE_ENABLED_FLAG = "ALERT_EMAIL_GATE_ENABLED";

// On by default; set to "false" to send condition alert emails as before.
export function isAlertEmailGateEnabled(): boolean {
  return process.env[ALERT_EMAIL_GATE_ENABLED_FLAG] !== "false";
}
