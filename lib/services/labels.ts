export const PROFESSIONAL_SEARCH_CODE = "professional-search";
export const PROFESSIONAL_SEARCH_DISPLAY_NAME = "Professional & Technical Search";

/** Legacy stored catalog name. Same offer as the display name (DEC-SVC-005). */
const LEGACY_PROFESSIONAL_SEARCH_NAMES = new Set(["Professional Search"]);

export function displayServiceName(code?: string | null, storedName?: string | null): string {
  if (code === PROFESSIONAL_SEARCH_CODE || (storedName && LEGACY_PROFESSIONAL_SEARCH_NAMES.has(storedName))) {
    return PROFESSIONAL_SEARCH_DISPLAY_NAME;
  }
  if (storedName) return storedName;
  if (!code) return "—";
  return code
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
