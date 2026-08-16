export const PROMOTIONAL_PRODUCT_PREFIX = "rc_promo_";
const PAID_LIFETIME_PRODUCT_IDS = new Set<string>([
  "app.quiversurf.surf.pro.lifetime",
]);

export function isPromotionalProductId(productId?: string | null): boolean {
  return Boolean(productId?.startsWith(PROMOTIONAL_PRODUCT_PREFIX));
}

export function isPaidLifetimeProductId(productId?: string | null): boolean {
  return Boolean(productId && PAID_LIFETIME_PRODUCT_IDS.has(productId));
}
