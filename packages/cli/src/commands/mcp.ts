/**
 * `avo mcp` — the MCP on-ramp. Bare invocation prints setup instructions +
 * config snippets for MCP clients; `--stdio` actually starts the server by
 * spawning the `@avodado/mcp` package's binary. The CLI deliberately has NO
 * dependency on `@avodado/mcp` (that would pull the MCP SDK into every CLI
 * install): it resolves a local install when one exists, else falls back to
 * `npx -y @avodado/mcp`.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/** Setup instructions + copy-paste config snippets for common MCP clients. */
export function mcpInstructions(): string {
  return `Avodado MCP server — author, validate, and render Avodado docs from any MCP client.
Transport is stdio; no configuration or API key required.

Run it directly:

  avo mcp --stdio            # starts @avodado/mcp (local install if present, else npx)

Claude Code:

  claude mcp add avodado -- npx -y @avodado/mcp

Claude Desktop / Cursor / any client with an mcpServers JSON
(Cursor: Settings → MCP → Add server, or .cursor/mcp.json in the project):

  {
    "mcpServers": {
      "avodado": { "command": "npx", "args": ["-y", "@avodado/mcp"] }
    }
  }

Tools exposed: get_authoring_guide · list_block_types · get_block_schema ·
check_document · render_document · resolve_refs · sync_openapi.
`;
}

/**
 * Finds a locally installed `avodado-mcp` bin by walking `node_modules/.bin`
 * up from `cwd`. Returns undefined when no local install is resolvable.
 */
export function resolveMcpBin(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    const bin = join(dir, 'node_modules', '.bin', 'avodado-mcp');
    if (existsSync(bin)) return bin;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Resolves the installed `@avodado/mcp` server entry (`dist/server.js`) via
 * Node's resolver — the ESM `createRequire` adaptation of the classic
 * `require.resolve('@avodado/mcp/package.json')` pattern. Catches package
 * managers whose `.bin` layout the walk above misses (e.g. pnpm virtual
 * stores when Avodado itself is a dependency).
 */
function resolveMcpServer(cwd: string): string | undefined {
  try {
    const req = createRequire(join(cwd, 'noop.js'));
    const pkgPath = req.resolve('@avodado/mcp/package.json');
    const server = join(dirname(pkgPath), 'dist', 'server.js');
    return existsSync(server) ? server : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Starts the MCP server on stdio and resolves with its exit code once it
 * stops. Prefers a local install (no network); falls back to
 * `npx -y @avodado/mcp`. stdio is inherited, so the MCP protocol flows through
 * this process untouched and Ctrl-C (SIGINT) reaches the child directly.
 */
export function runMcpStdio(cwd: string): Promise<number> {
  const bin = resolveMcpBin(cwd);
  const server = bin === undefined ? resolveMcpServer(cwd) : undefined;
  const [cmd, args]: [string, string[]] =
    bin !== undefined
      ? [bin, []]
      : server !== undefined
        ? [process.execPath, [server]]
        : ['npx', ['-y', '@avodado/mcp']];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      // .bin shims and npx are .cmd files on Windows and need a shell.
      shell: process.platform === 'win32' && cmd !== process.execPath,
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      // Forward the child's exit code; a signal death maps to 128 + n style
      // (SIGINT → 130), matching what a shell would report.
      resolve(code ?? (signal === 'SIGINT' ? 130 : 1));
    });
  });
}
