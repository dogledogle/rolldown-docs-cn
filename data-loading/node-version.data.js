import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { engines } = require('rolldown/package.json');

export default {
  load() {
    return {
      nodeVersion: engines.node,
    };
  },
};
