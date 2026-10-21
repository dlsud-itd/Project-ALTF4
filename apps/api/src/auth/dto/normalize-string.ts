export function normalizeString(
  value: unknown,
  normalizer: (value: string) => string,
): unknown {
  return typeof value === 'string' ? normalizer(value) : value;
}
