/**
 * The traffic server's protocol surface.
 *
 * Hand-rolling JSON-RPC instead of taking an SDK means the protocol is now
 * this repository's problem, so it is tested like everything else. What is
 * checked here is the part that is deterministic and the part that is easy to
 * get wrong: the handshake, the tool list, and the two rules that keep this
 * server narrow. Anything that would actually reach Vercel is not tested,
 * because it would need a login and would assert that a network is up.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';

/** Feed the server some messages, collect whatever it writes back. */
function converse(messages: readonly unknown[]): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/mcp/analytics-server.mjs'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('error', reject);
    child.on('close', () => {
      resolve(
        out
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line)),
      );
    });
    for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
    child.stdin.end();
  });
}

const rpc = (id: number, method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params ? { params } : {}),
});

describe('the traffic MCP server', () => {
  it('completes the handshake and lists exactly the read-only tools', async () => {
    const replies = await converse([
      rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }),
      rpc(2, 'tools/list'),
    ]);

    const handshake = replies.find((r) => r.id === 1);
    assert.equal(handshake?.result.protocolVersion, '2025-06-18');
    assert.deepEqual(handshake?.result.capabilities, { tools: {} });

    const tools = replies.find((r) => r.id === 2)?.result.tools ?? [];
    assert.deepEqual(
      tools.map((t: { name: string }) => t.name).sort(),
      ['analytics_schema', 'traffic_breakdown', 'traffic_by_day', 'traffic_summary'],
    );
    // Every tool must describe its arguments, or a client cannot call it.
    for (const tool of tools) assert.equal(tool.inputSchema.type, 'object');
  });

  /**
   * A message with no `id` is a notification and gets NOTHING back — not an
   * empty result, not an error with a null id. `notifications/initialized`
   * arrives immediately after the handshake on every connection, so a server
   * that answers it is broken from the first second.
   */
  it('answers a notification with silence', async () => {
    const replies = await converse([
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } },
      rpc(9, 'ping'),
    ]);
    assert.deepEqual(
      replies.map((r) => r.id),
      [9],
    );
  });

  it('refuses a tool it does not have', async () => {
    const [reply] = await converse([rpc(3, 'tools/call', { name: 'delete_everything' })]);
    assert.equal(reply?.error.code, -32602);
  });

  /**
   * The narrowness guarantee, at the only point a caller can push on it.
   *
   * A rejected dimension must be rejected BEFORE anything is spawned — which
   * is also why this test is fast and needs no Vercel login. There is no shell
   * anywhere in the server, so a string like this was never dangerous; the
   * point is that the set of things this server will ask Vercel is closed and
   * written down, rather than assembled from whatever it is handed.
   */
  it('groups only by dimensions on its own list, and never spawns to find out', async () => {
    const [reply] = await converse([
      rpc(4, 'tools/call', {
        name: 'traffic_breakdown',
        arguments: { dimension: 'deployments; cat .env.local' },
      }),
    ]);
    const text: string = reply?.result.content[0].text;
    assert.match(text, /Unknown dimension/);
    assert.match(text, /country/);
    assert.doesNotMatch(text, /\.env/);
  });
});
