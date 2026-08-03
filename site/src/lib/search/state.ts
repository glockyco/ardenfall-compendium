export type SearchStatus = "idle" | "loading" | "results" | "empty" | "error";

export type SearchDisplayState =
  | { kind: "guidance"; message: string }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "results"; message: string };

export function searchDisplayState(
  query: string,
  status: SearchStatus,
  resultCount: number,
): SearchDisplayState {
  const value = query.trim();
  if (value.length === 0) {
    return {
      kind: "guidance",
      message: "Enter a name or description to find a page.",
    };
  }
  if (status === "error") {
    return {
      kind: "error",
      message: "Search is not available because the search script did not load.",
    };
  }
  if (status === "loading") {
    return { kind: "loading", message: `Searching for ${value}.` };
  }
  if (resultCount === 0) {
    return { kind: "empty", message: `No results for ${value}.` };
  }
  return {
    kind: "results",
    message: `${resultCount} ${resultCount === 1 ? "result" : "results"} found for ${value}.`,
  };
}
