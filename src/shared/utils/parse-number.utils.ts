export const parseNumber = (value: unknown): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};
