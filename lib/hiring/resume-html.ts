import mammoth from "mammoth";

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

function isSafeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("data:image/")
  );
}

export function sanitizeResumeHtml(html: string) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?([^\s>/]+)([^>]*)>/gi, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (tag.startsWith("!") || tag.startsWith("?")) return "";
    const isClose = full.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClose) return `</${tag}>`;
    const attrs: string[] = [];
    const attrPattern = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let match: RegExpExecArray | null;
    while ((match = attrPattern.exec(rawAttrs))) {
      const name = match[1].toLowerCase();
      if (name.startsWith("on") || name === "srcset" || name === "style") continue;
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      if (tag === "a" && name === "href" && isSafeUrl(value)) {
        attrs.push(`href="${value.replaceAll('"', "")}" rel="noreferrer noopener" target="_blank"`);
      }
      if (tag === "img" && name === "src" && isSafeUrl(value) && value.toLowerCase().startsWith("data:image/")) {
        attrs.push(`src="${value.replaceAll('"', "")}" alt=""`);
      }
      if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan") && /^\d+$/.test(value)) {
        attrs.push(`${name}="${value}"`);
      }
    }
    if (tag === "br" || tag === "hr" || tag === "img") return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
    return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
  });
}

export async function convertDocxToPreviewHtml(body: Uint8Array) {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(body) });
  const html = sanitizeResumeHtml(result.value).trim();
  if (!html) {
    throw new Error("The Word resume did not contain previewable text.");
  }
  return html;
}
