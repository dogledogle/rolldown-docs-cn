import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { stripVTControlCharacters } from 'node:util';

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(require.resolve('rolldown/package.json'));
const cliPath = path.join(packageDirectory, 'bin/cli.mjs');

export default {
  load() {
    return {
      help: stripVTControlCharacters(
        execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' }),
      ),
    };
  },
};
