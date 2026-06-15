/**
 * `avo` CLI entry point. Tsup adds the `#!/usr/bin/env node` shebang at build
 * time; this file is the JS that runs after.
 */

import { main } from './app.js';

const code = await main(process.argv);
process.exit(code);
