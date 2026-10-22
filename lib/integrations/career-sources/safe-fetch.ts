import { lookup } from "node:dns/promises";
import * as http from "node:http";
import type { IncomingMessage } from "node:http";
import * as https from "node:https";
import type { RequestOptions } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

import { bareHostname, isBlockedHostname, isPrivateAddress, SafeFetchError } from "./network-guards";
import { DISCOVERY_USER_AGENT, MAX_REDIRECTS, MAX_RESPONSE_BYTES, type DiscoveryDeps } from "./types";

/**
 * Node 24 bundles undici inside global fetch but does not expose `undici` or `node:undici`.
 * `https.request` / `http.request` `lookup` is the socket DNS hook already in this runtime.
 * The callback returns only addresses this process already accepted. It does not resolve again.
 */
export function pinnedConnectLookup(addresses: readonly string[]): NonNullable<RequestOptions["lookup"]> {
  if (!addresses.length || addresses.some((address) => isPrivateAddress(address))) {
    throw new SafeFetchError("The host resolves to a private or internal address.");
  }
  const records = addresses.map((address) => ({
    address,
    family: (isIP(address) === 6 ? 6 : 4) as 4 | 6,
  }));
  return ((hostname, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    if (!done) return;
    const all = typeof options === "object" && options !== null && "all" in options && Boolean(options.all);
    if (all) {
      done(null, records);
      return;
    }
    done(null, records[0].address, records[0].family);
  }) as NonNullable<RequestOptions["lookup"]>;
}

type PinnedRequestInit = RequestInit & {
  lookup: NonNullable<RequestOptions["lookup"]>;
};

function defaultSocketRequest(url: URL, options: RequestOptions, callback: (incoming: IncomingMessage) => void) {
  const request = url.protocol === "https:" ? https.request : http.request;
  return request(url, options, callback);
}

const lastRequestAt = new Map<string, number>();

export async function publicDnsLookup(hostname: string) {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return [bare];
  const records = await lookup(bare, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertPublicHttpUrl(raw: string, resolve: (hostname: string) => Promise<string[]>) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("URL is not valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only http and https URLs can be fetched.");
  }
  if (url.username || url.password) throw new SafeFetchError("URLs with embedded credentials are rejected.");
  if (!url.hostname || isBlockedHostname(url.hostname)) {
    throw new SafeFetchError("That host is not a public discovery target.");
  }
  const bare = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(bare) ? [bare] : await resolve(bare);
  if (!addresses.length) throw new SafeFetchError("The host did not resolve.");
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new SafeFetchError("The host resolves to a private or internal address.");
  }
  return { url, addresses };
}

export async function safeFetch(raw: string, deps: DiscoveryDeps = {}) {
  const fetchImpl = deps.fetchImpl;
  const resolve = deps.lookup ?? publicDnsLookup;
  const minIntervalMs = deps.minIntervalMs ?? 1000;
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = await assertPublicHttpUrl(current, resolve);
    const url = checked.url;
    await paceHost(url.hostname, minIntervalMs);
    const init: PinnedRequestInit = {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json, text/html;q=0.8, */*;q=0.1",
        "user-agent": DISCOVERY_USER_AGENT,
        host: url.host,
      },
      signal: AbortSignal.timeout(15_000),
      lookup: pinnedConnectLookup(checked.addresses),
    };
    const response = fetchImpl ? await fetchImpl(url, init) : await nodePinnedFetch(url, init, deps.socketRequest ?? defaultSocketRequest);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new SafeFetchError("Redirect had no destination.");
      if (hop === MAX_REDIRECTS) throw new SafeFetchError("Too many redirects.");
      current = new URL(location, url).href;
      continue;
    }
    return {
      url: url.href,
      status: response.status,
      body: await readLimited(response),
    };
  }
  throw new SafeFetchError("Too many redirects.");
}

export function robotsAllows(robotsText: string, path: string, agent = "WorkforceOS-OpportunityDiscovery") {
  const groups = parseRobots(robotsText);
  const specific = groups.find((group) => group.agents.some((name) => name.toLowerCase() === agent.toLowerCase()));
  const group = specific ?? groups.find((entry) => entry.agents.includes("*"));
  if (!group) return true;
  let allowed = true;
  let best = -1;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (!path.startsWith(rule.path) && rule.path !== "/") continue;
    if (rule.path === "/" || path.startsWith(rule.path)) {
      if (rule.path.length > best || (rule.path.length === best && rule.allow)) {
        best = rule.path.length;
        allowed = rule.allow;
      }
    }
  }
  return allowed;
}

export async function originAllowsFetch(target: URL, deps: DiscoveryDeps) {
  try {
    const robots = await safeFetch(`${target.origin}/robots.txt`, { ...deps, minIntervalMs: deps.minIntervalMs ?? 0 });
    if (robots.status === 404) return { allowed: true, blocked: false, reason: null as string | null };
    if (robots.status >= 400) {
      return { allowed: false, blocked: false, reason: `robots.txt returned ${robots.status}. Automated fetch stopped.` };
    }
    const allowed = robotsAllows(robots.body, target.pathname || "/");
    return allowed
      ? { allowed: true, blocked: false, reason: null }
      : { allowed: false, blocked: true, reason: "robots.txt disallows this path. Automated fetch stopped." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "robots.txt could not be checked.";
    return { allowed: false, blocked: false, reason: message };
  }
}

async function nodePinnedFetch(
  url: URL,
  init: PinnedRequestInit,
  socketRequest: NonNullable<DiscoveryDeps["socketRequest"]>,
): Promise<Response> {
  const headers = init.headers as Record<string, string>;
  const options: RequestOptions = {
    method: "GET",
    headers,
    lookup: init.lookup,
    signal: init.signal ?? undefined,
  };
  if (url.protocol === "https:") {
    options.servername = bareHostname(url.hostname);
    options.rejectUnauthorized = true;
  }
  return new Promise((resolve, reject) => {
    const req = socketRequest(url, options, (incoming) => {
      const headerBag = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value === undefined) continue;
        headerBag.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      resolve(new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
        status: incoming.statusCode ?? 0,
        headers: headerBag,
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function paceHost(host: string, minIntervalMs: number) {
  if (minIntervalMs <= 0) return;
  const key = host.toLowerCase();
  const previous = lastRequestAt.get(key) ?? 0;
  const wait = previous + minIntervalMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(key, Date.now());
}

async function readLimited(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new SafeFetchError("Response exceeded the discovery size limit.");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buffer);
}

function parseRobots(text: string) {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: { agents: string[]; rules: { allow: boolean; path: string }[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/#.*/, "").trim();
    if (!cleaned) continue;
    const split = cleaned.indexOf(":");
    if (split < 0) continue;
    const field = cleaned.slice(0, split).trim().toLowerCase();
    const value = cleaned.slice(split + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}
