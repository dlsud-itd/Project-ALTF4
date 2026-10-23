export function successResponse<T extends Record<string, unknown>>(
  message: string,
  data: T,
) {
  return { message, ...data };
}
