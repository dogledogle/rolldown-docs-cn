import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, test } from 'node:test';
import {
  buildPrompt,
  createPatch,
  finalize,
  isProtectedPath,
  parseNameStatusZ,
  prepare,
  validateMarkdownStructure,
  validateState,
  validateWorkspace,
} from './upstream-agent.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(cwd, path, contents) {
  const target = join(cwd, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function commit(cwd, message) {
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function fixtureRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'rolldown-upstream-agent-'));
  temporaryDirectories.push(cwd);
  git(cwd, ['init']);
  git(cwd, ['config', 'user.name', 'Upstream Test']);
  git(cwd, ['config', 'user.email', 'upstream-test@example.com']);
  git(cwd, ['config', 'core.autocrlf', 'false']);

  write(cwd, 'docs/edit.md', '---\ntitle: Edit\n---\n\nOld text.\n\n```js\nconst x = 1\n```\n');
  write(cwd, 'docs/delete.md', 'Delete this file.\n');
  write(cwd, 'docs/rename-old.md', 'Rename without changing the contents.\n');
  write(cwd, 'docs/image.bin', Buffer.from([0, 1, 2, 3]));
  const baselineCommit = commit(cwd, 'baseline docs');
  const baselineTree = git(cwd, ['rev-parse', `${baselineCommit}:docs`]);

  write(cwd, 'edit.md', '---\ntitle: 编辑\n---\n\n旧文本。\n\n```js\nconst x = 1\n```\n');
  write(cwd, 'delete.md', '删除这个文件。\n');
  write(cwd, 'rename-old.md', '保留中文并重命名。\n');
  write(cwd, 'image.bin', Buffer.from([0, 1, 2, 3]));
  commit(cwd, 'add current Chinese tree');

  write(cwd, 'docs/edit.md', '---\ntitle: Edit\n---\n\nNew text.\n\n```js\nconst x = 1\n```\n');
  rmSync(join(cwd, 'docs/delete.md'));
  write(cwd, 'docs/add.md', 'A newly added page.\n');
  git(cwd, ['mv', 'docs/rename-old.md', 'docs/rename-new.md']);
  write(cwd, 'docs/image.bin', Buffer.from([0, 9, 8, 7]));
  const targetCommit = commit(cwd, 'updated docs');
  const targetTree = git(cwd, ['rev-parse', `${targetCommit}:docs`]);

  write(cwd, '.upstream-sync/state.json', `${JSON.stringify({
    version: 1,
    sourceRepository: 'https://example.com/upstream.git',
    sourcePath: 'docs',
    sourceCommit: baselineCommit,
    sourceTree: baselineTree,
  }, null, 2)}\n`);

  return { cwd, baselineCommit, baselineTree, targetCommit, targetTree };
}

test('parseNameStatusZ handles ordinary paths and renames', () => {
  assert.deepEqual(parseNameStatusZ('M\0guide.md\0R095\0old.md\0new.md\0A\0added.md\0'), [
    { status: 'M', oldPath: 'guide.md', newPath: 'guide.md' },
    { status: 'R', score: 95, oldPath: 'old.md', newPath: 'new.md' },
    { status: 'A', newPath: 'added.md' },
  ]);
});

test('state validation rejects malformed commit identifiers', () => {
  assert.throws(() => validateState({
    version: 1,
    sourceRepository: 'https://example.com/upstream.git',
    sourcePath: 'docs',
    sourceCommit: 'not-a-commit',
    sourceTree: 'a'.repeat(40),
  }), /Invalid sourceCommit/);
});

test('prepare returns no changes for the recorded source tree', () => {
  const fixture = fixtureRepository();
  const result = prepare({
    cwd: fixture.cwd,
    sourceRef: fixture.baselineCommit,
    outputDir: join(fixture.cwd, '.context-no-change'),
    applyBinary: false,
  });
  assert.equal(result.hasChanges, false);
  assert.equal(result.manifest.changes.length, 0);
});

test('prepare describes text, rename, deletion, addition, and binary changes', () => {
  const fixture = fixtureRepository();
  const outputDir = join(fixture.cwd, '.context');
  const result = prepare({
    cwd: fixture.cwd,
    sourceRef: fixture.targetCommit,
    outputDir,
  });

  assert.equal(result.hasChanges, true);
  assert.equal(result.manifest.target.sourceTree, fixture.targetTree);
  assert.deepEqual(new Set(result.manifest.changes.map((change) => change.status)), new Set(['A', 'D', 'M', 'R']));
  assert.equal(result.manifest.changes.find((change) => change.newPath === 'image.bin').binary, true);
  assert.deepEqual(readFileSync(join(fixture.cwd, 'image.bin')), Buffer.from([0, 9, 8, 7]));
  const prompt = readFileSync(join(outputDir, 'prompt.md'), 'utf8');
  assert.match(prompt, new RegExp(fixture.baselineTree));
  assert.match(prompt, new RegExp(fixture.targetTree));
  assert.match(prompt, /untrusted content/);
});

test('prepare enforces file and line limits before invoking an agent', () => {
  const fixture = fixtureRepository();
  assert.throws(() => prepare({
    cwd: fixture.cwd,
    sourceRef: fixture.targetCommit,
    outputDir: join(fixture.cwd, '.context-limited'),
    maxFiles: 1,
    applyBinary: false,
  }), /limit is 1/);
});

test('finalize validates a translated tree and creates a binary-safe patch', () => {
  const fixture = fixtureRepository();
  const outputDir = mkdtempSync(join(tmpdir(), 'rolldown-upstream-context-'));
  temporaryDirectories.push(outputDir);
  const { manifest } = prepare({ cwd: fixture.cwd, sourceRef: fixture.targetCommit, outputDir });

  write(fixture.cwd, 'edit.md', '---\ntitle: 编辑\n---\n\n新文本。\n\n```js\nconst x = 1\n```\n');
  rmSync(join(fixture.cwd, 'delete.md'));
  write(fixture.cwd, 'add.md', '一个新页面。\n');
  rmSync(join(fixture.cwd, 'rename-old.md'));
  write(fixture.cwd, 'rename-new.md', '保留中文并重命名。\n');
  const reportPath = join(outputDir, 'agent-report.json');
  writeFileSync(reportPath, `${JSON.stringify({
    targetCommit: fixture.targetCommit,
    changedFiles: ['edit.md', 'delete.md', 'add.md', 'rename-old.md', 'rename-new.md', 'image.bin'],
    unresolved: [],
    checks: ['three-way translation completed'],
    outcome: 'success',
  })}\n`);

  const report = finalize({
    cwd: fixture.cwd,
    manifestPath: join(outputDir, 'manifest.json'),
    reportPath,
    buildStatus: 'passed',
    base: fixture.targetCommit,
  });
  assert.equal(report.outcome, 'success');
  assert.doesNotThrow(() => validateWorkspace({
    cwd: fixture.cwd,
    base: fixture.targetCommit,
    manifestPath: join(outputDir, 'manifest.json'),
    reportPath,
  }));
  const patchPath = join(outputDir, 'translation.patch');
  const digest = createPatch({ cwd: fixture.cwd, base: fixture.targetCommit, outputPath: patchPath });
  assert.match(digest, /^[0-9a-f]{64}$/);
  const patch = readFileSync(patchPath, 'utf8');
  assert.match(patch, /diff --git a\/edit\.md b\/edit\.md/);
  assert.match(patch, /diff --git a\/image\.bin b\/image\.bin/);
  assert.match(patch, /diff --git a\/\.upstream-sync\/state\.json b\/\.upstream-sync\/state\.json/);
  assert.equal(manifest.target.sourceTree, fixture.targetTree);
});

test('validation rejects protected changes and exact secret leakage', () => {
  const fixture = fixtureRepository();
  const outputDir = mkdtempSync(join(tmpdir(), 'rolldown-upstream-protected-'));
  temporaryDirectories.push(outputDir);
  prepare({ cwd: fixture.cwd, sourceRef: fixture.targetCommit, outputDir, applyBinary: false });
  const reportPath = join(outputDir, 'agent-report.json');
  writeFileSync(reportPath, `${JSON.stringify({
    targetCommit: fixture.targetCommit,
    changedFiles: [],
    unresolved: [],
    checks: [],
    outcome: 'success',
  })}\n`);
  const incompleteReport = finalize({
    cwd: fixture.cwd,
    manifestPath: join(outputDir, 'manifest.json'),
    reportPath,
    base: fixture.targetCommit,
  });
  assert.equal(incompleteReport.outcome, 'needs_review');
  assert.ok(incompleteReport.unresolved.some((item) => item.path === 'edit.md'));

  write(fixture.cwd, 'scripts/sync-upstream.mjs', 'console.log("tampered")\n');
  assert.throws(() => validateWorkspace({
    cwd: fixture.cwd,
    base: fixture.targetCommit,
    manifestPath: join(outputDir, 'manifest.json'),
    reportPath,
  }), /Protected paths were modified/);
  rmSync(join(fixture.cwd, 'scripts'), { recursive: true });

  const previousSecret = process.env.TRANSLATION_API_KEY;
  process.env.TRANSLATION_API_KEY = 'test-secret-that-must-not-leak';
  write(fixture.cwd, 'leak.md', `leaked: ${process.env.TRANSLATION_API_KEY}\n`);
  try {
    assert.throws(() => validateWorkspace({
      cwd: fixture.cwd,
      base: fixture.targetCommit,
      manifestPath: join(outputDir, 'manifest.json'),
      reportPath,
    }), /contains TRANSLATION_API_KEY/);
  } finally {
    if (previousSecret === undefined) delete process.env.TRANSLATION_API_KEY;
    else process.env.TRANSLATION_API_KEY = previousSecret;
  }
});

test('Markdown validation preserves frontmatter keys and code fence structure', () => {
  const upstream = '---\ntitle: Example\noutline: deep\n---\n\n```js\nconst x = 1\n```\n';
  const translated = '---\ntitle: 示例\noutline: deep\n---\n\n```js\nconst x = 1\n```\n';
  assert.doesNotThrow(() => validateMarkdownStructure(upstream, translated, 'guide.md'));
  assert.throws(
    () => validateMarkdownStructure(upstream, '---\ntitle: 示例\n---\n\n```js\nconst x = 1\n', 'guide.md'),
    /code fence count differs|missing frontmatter key/,
  );
});

test('automation and workflow paths are protected while state is deterministic', () => {
  assert.equal(isProtectedPath('.github/workflows/upstream-sync.yml'), true);
  assert.equal(isProtectedPath('.upstream-sync/report.json'), true);
  assert.equal(isProtectedPath('.upstream-sync/state.json'), false);
  assert.equal(isProtectedPath('scripts/sync-upstream.mjs'), true);
  assert.equal(isProtectedPath('.vitepress/config.ts'), false);
  assert.equal(isProtectedPath('package.json'), false);
});

test('workflow keeps APIClub Responses API-key compatibility settings', () => {
  const workflow = readFileSync(
    join(import.meta.dirname, '..', '.github', 'workflows', 'upstream-sync.yml'),
    'utf8',
  );
  assert.match(workflow, /wire_api = "responses"/);
  assert.match(
    workflow,
    /http_headers = \{ "x-openai-actor-authorization" = "local-image-extension" \}/,
  );
});

test('prompt explicitly uses old English, new English, and current Chinese', () => {
  const prompt = buildPrompt({
    baseline: { sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40) },
    target: { sourceCommit: 'c'.repeat(40), sourceTree: 'd'.repeat(40) },
    changes: [{ status: 'M', oldPath: 'guide.md', newPath: 'guide.md', binary: false }],
  });
  assert.match(prompt, /Old English/);
  assert.match(prompt, /New English/);
  assert.match(prompt, /Current Simplified Chinese/);
});
