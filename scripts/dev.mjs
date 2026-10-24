import {execFileSync} from 'node:child_process';
import path from 'node:path';

execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
process.env.SERVE_ROOT=path.resolve('dist');
await import('./serve.mjs');
