export async function readReplayableBody(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer());
  const replay = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw,
  });
  return { raw, replay, text: new TextDecoder().decode(raw) };
}
