/**
 * Determines the appropriate heading text for the Best Conditions section
 * based on the location source and home beach information.
 *
 * @param locationSource - The source of location data ('gps' or 'home-beach')
 * @param homeBeachName - Optional name of the user's home beach
 * @returns The formatted heading text
 *
 * @example
 * // GPS location
 * getBestConditionsHeading('gps') // => "Best Conditions Near You"
 *
 * @example
 * // Home beach with name
 * getBestConditionsHeading('home-beach', 'Malibu') // => "Best Conditions Near Malibu"
 *
 * @example
 * // Home beach without name
 * getBestConditionsHeading('home-beach') // => "Best Conditions Near Home"
 */
export function getBestConditionsHeading(
  locationSource: 'gps' | 'home-beach',
  homeBeachName?: string | null
): string {
  if (locationSource === 'gps') {
    return "Best Conditions Near You";
  }

  if (homeBeachName) {
    return `Best Conditions Near ${homeBeachName}`;
  }

  return "Best Conditions Near Home";
}
