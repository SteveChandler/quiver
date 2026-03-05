export interface DeviceInfo {
  device_type: "mobile" | "desktop" | "tablet";
  os: string;
  browser: string;
}

export function parseUserAgent(ua: string): DeviceInfo {
  const device_type = detectDeviceType(ua);
  const os = detectOS(ua);
  const browser = detectBrowser(ua);
  return { device_type, os, browser };
}

function detectDeviceType(ua: string): DeviceInfo["device_type"] {
  if (/iPad|Android.*Tablet|Kindle|Silk/i.test(ua)) return "tablet";
  if (/iPhone|Android|Mobile|IEMobile|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  // Safari must come after Chrome — Chrome UA also contains "Safari"
  if (/Safari/i.test(ua)) return "Safari";
  return "unknown";
}
