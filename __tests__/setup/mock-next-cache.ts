// Minimal mock for next/cache used in tests

export const revalidatePath = jest.fn();
export const revalidateTag = jest.fn();

// Return-through wrapper for unstable_cache: simply returns the original fn
export const unstable_cache = ((fn: any) => fn) as any;

