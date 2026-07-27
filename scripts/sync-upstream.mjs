import { execFileSync } from 'node:child_process';

const remote = 'upstream';
const sourceBranch = 'main';
const trackingBranch = 'upstream-docs';
const sourcePath = 'docs';

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
    ...options,
  }).trim();
}

git(['fetch', remote, sourceBranch]);

const sourceRef = `${remote}/${sourceBranch}`;
const sourceCommit = git(['rev-parse', sourceRef]);
const sourceTree = git(['rev-parse', `${sourceRef}:${sourcePath}`]);

let previousCommit;
try {
  previousCommit = git(['rev-parse', `refs/heads/${trackingBranch}`]);
} catch {
  previousCommit = undefined;
}

if (previousCommit) {
  const previousTree = git(['rev-parse', `${previousCommit}^{tree}`]);
  if (previousTree === sourceTree) {
    console.log(`Upstream docs are already current at ${sourceCommit}.`);
    process.exit(0);
  }
}

const sourceDate = git(['show', '-s', '--format=%cI', sourceRef]);
const message = [
  `Import Rolldown docs from ${sourceCommit}`,
  '',
  'Source: git@github.com:rolldown/rolldown.git',
  `Path: ${sourcePath}/`,
  `Commit: ${sourceCommit}`,
  '',
].join('\n');
const commitArgs = ['commit-tree', sourceTree];
if (previousCommit) commitArgs.push('-p', previousCommit);

const snapshotCommit = git(commitArgs, {
  input: message,
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: 'Rolldown Docs Sync',
    GIT_AUTHOR_EMAIL: 'docs-sync@localhost',
    GIT_AUTHOR_DATE: sourceDate,
    GIT_COMMITTER_NAME: 'Rolldown Docs Sync',
    GIT_COMMITTER_EMAIL: 'docs-sync@localhost',
  },
});

git(['update-ref', `refs/heads/${trackingBranch}`, snapshotCommit, previousCommit ?? '']);

console.log(`Updated ${trackingBranch} to Rolldown ${sourceCommit}.`);
if (previousCommit) {
  console.log(`Review upstream changes with:`);
  console.log(`  git diff ${previousCommit}..${snapshotCommit}`);
  console.log('Port those changes to the Chinese files on main; do not merge blindly.');
}
