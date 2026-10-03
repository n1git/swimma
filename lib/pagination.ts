export const PAGE_SIZE = 50;

export function pageRange(raw: string | undefined) {
  const page = Math.max(1, Math.floor(Number(raw) || 1));
  const from = (page - 1) * PAGE_SIZE;
  return { page, from, to: from + PAGE_SIZE - 1 };
}
