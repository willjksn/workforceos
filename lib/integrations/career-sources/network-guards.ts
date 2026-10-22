import { isIP } from "node:net";

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const METADATA_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
  "instance-data.ec2.internal",
]);

export function bareHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
}

export function isBlockedHostname(hostname: string) {
  const host = bareHostname(hostname);
  if (!host) return true;
  if (METADATA_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".metadata.google.internal")) return true;
  if (/^\d+$/.test(host)) return true;
  return false;
}

/** True for loopback, private, link-local, and metadata addresses. Unparseable values are rejected. */
export function isPrivateAddress(address: string): boolean {
  let ip = bareHostname(address);
  if (ip.includes(".")) {
    const lastColon = ip.lastIndexOf(":");
    if (lastColon > -1 && isIP(ip.slice(lastColon + 1)) === 4) {
      return isPrivateAddress(ip.slice(lastColon + 1));
    }
  }
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateAddress(mapped);
  }
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const expanded = expandIpv6(ip);
  if (!expanded) return true;
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  if (expanded === "0000:0000:0000:0000:0000:0000:0000:0000") return true;
  const first = Number.parseInt(expanded.slice(0, 4), 16);
  if (first >= 0xfc00 && first <= 0xfdff) return true;
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  if (first >= 0xff00) return true;
  if (expanded.startsWith("0000:0000:0000:0000:0000:ffff:")) {
    const hi = Number.parseInt(expanded.slice(30, 34), 16);
    const lo = Number.parseInt(expanded.slice(35), 16);
    const mapped = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
    return isPrivateIpv4(mapped);
  }
  return false;
}

function expandIpv6(ip: string) {
  const lower = ip.toLowerCase();
  if (lower.split("::").length > 2) return null;
  const [head, tail] = lower.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = lower.includes("::") && tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;
  const parts = lower.includes("::") ? [...headParts, ...Array(missing).fill("0"), ...tailParts] : headParts;
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => part.padStart(4, "0")).join(":");
}
