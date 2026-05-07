export type ReviewRequiredPhotoRecord = {
  approved: false;
};

export function requirePhotoReview<T extends Record<string, unknown>>(
  record: T,
): T & ReviewRequiredPhotoRecord {
  return {
    ...record,
    approved: false,
  };
}
