export const searchQueryParam = "q";

export function encodeSearchQuery(query: string): string {
  const value = query.trim();
  if (value.length === 0) return "";

  const params = new URLSearchParams();
  params.set(searchQueryParam, value);
  return params.toString();
}

export function decodeSearchQuery(params: URLSearchParams): string {
  return params.get(searchQueryParam)?.trim() ?? "";
}
