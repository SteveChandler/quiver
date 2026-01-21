/**
 * Shared constants for email templates and email action pages.
 * These ensure visual consistency across all email-related UI.
 */

export const EMAIL_COLORS = {
  primary: '#3b82f6', // Blue - primary actions
  primaryHover: '#2563eb', // Darker blue for hover
  error: '#dc2626', // Red - errors
  errorBg: '#fef2f2', // Light red background
  success: '#16a34a', // Green - success
  successBg: '#f0fdf4', // Light green background
  text: '#1f2937', // Dark gray text
  textMuted: '#6b7280', // Muted gray text
  textSecondary: '#666666', // Secondary text color
  textTertiary: '#999999', // Tertiary/footer text color
  pageBg: '#fafafa', // Page background
  cardBg: '#ffffff', // Card background
  cardBgAlt: '#f8fafc', // Alternative card background
  chipBg: '#e0f2fe', // Chip background (light blue)
  chipText: '#0369a1', // Chip text (dark blue)
  border: '#eeeeee', // Border color
  heading: '#1e40af', // Heading color (dark blue)
} as const;

export const EMAIL_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const EMAIL_BUTTON_STYLE = `
  display: inline-block;
  padding: 12px 24px;
  margin: 8px 4px;
  background: ${EMAIL_COLORS.primary};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
`.trim();

/**
 * Button style variant with smaller padding for welcome email grids.
 */
export const EMAIL_BUTTON_STYLE_COMPACT = `
  display: inline-block;
  padding: 12px 20px;
  margin: 4px;
  background: ${EMAIL_COLORS.primary};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
`.trim();

/**
 * Chip/tag style for condition labels.
 */
export const EMAIL_CHIP_STYLE = `
  display: inline-block;
  padding: 6px 12px;
  margin: 2px;
  background: ${EMAIL_COLORS.chipBg};
  color: ${EMAIL_COLORS.chipText};
  border-radius: 16px;
  font-size: 13px;
`.trim();
