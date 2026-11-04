import type { FeatureAccess, FeatureAccessOptions } from "@/lib/flags/founding-access";

/**
 * Stand-ins for `resolveFeatureAccess` in gate tests. The resolver's own
 * contract (cache, fail-closed, guests) is covered in
 * lib/flags/__tests__/founding-access.test.ts.
 */
export function featureAccessOff(
  _userId: string | null | undefined,
  isPro: boolean,
): FeatureAccess {
  return { isPro, foundingAccess: false, hasFeatureAccess: isPro };
}

export function featureAccessOn(
  userId: string | null | undefined,
  isPro: boolean,
  options: FeatureAccessOptions = {},
): FeatureAccess {
  const foundingAccess = !isPro && !!userId && !options.billingIssue;
  return { isPro, foundingAccess, hasFeatureAccess: isPro || foundingAccess };
}
