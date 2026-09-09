export type IntegrationFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

let testFetch: IntegrationFetch | null = null;

export function setIntegrationFetchForTests(fn: IntegrationFetch | null) {
  testFetch = fn;
}

export function resetIntegrationFetchForTests() {
  testFetch = null;
}

export function integrationFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const impl = testFetch ?? fetch;
  return impl(input, init);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
