// Pagination helper
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

export function applyPagination(query: any, options: PaginationOptions = {}) {
  const {
    page = 1,
    limit = 10,
    orderBy = "created_at",
    orderDirection = "desc",
  } = options;
  const offset = (page - 1) * limit;

  return query
    .order(orderBy, { ascending: orderDirection === "asc" })
    .range(offset, offset + limit - 1);
}

// Validation helpers
export function validateRequired<T>(
  data: T,
  requiredFields: (keyof T)[]
): string | null {
  for (const field of requiredFields) {
    if (!data[field]) {
      return `${String(field)} is required`;
    }
  }
  return null;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
