// Validates a user-supplied `return_to` value as a safe same-origin relative
// path. Anything absolute, protocol-relative, or pointing at a reserved auth
// route collapses to "/" instead of being echoed back.

export function safeRelativeReturnPath(value: string, reservedPaths: string[] = []): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (reservedPaths.includes(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}
