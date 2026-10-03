import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

assert(Number(process.versions.node.split('.')[0]) >= 24, 'Runtime Lab requires Node.js 24 or later');
const args = process.argv.slice(2);
assert(args.every(arg => arg === '--background'), 'Usage: node scripts/check-runtime-lab.mjs [--background]');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sample = join(repo, 'examples/runtime-lab');
const normalize = text => text.replaceAll('\r\n', '\n');
const read = async path => normalize(await readFile(path, 'utf8'));
const snapshot = async id => JSON.parse(await read(join(repo, `evidence/desktop-lab/${id}/file-observations.json`)));
const pre = await snapshot('hook-pre-tool');
const background = await snapshot('background-return');
const expected = new Map();
for (const file of pre.before.files) {
  if (file.path !== '.codex/hooks.json') expected.set(`start/${file.path}`, file.text);
}
expected.set('results/.codex/hook-lab/allowed.txt', pre.after.files.find(file => file.path === '.codex/hook-lab/allowed.txt').text);
expected.set('start/lab/background-delay.mjs', background.script.before.content);
expected.set('start/src/price.ts', background.importedPriceSource.text);
for (const id of ['patch-recovery', 'plan-status']) {
  for (const file of (await snapshot(id)).files) {
    expected.set(`start/${file.path}`, file.before.content);
    if (file.path.endsWith('/price.ts')) expected.set(`results/${file.path}`, file.after.text);
  }
}
for (const [path, text] of expected) assert.equal(await read(join(sample, path)), normalize(text), `${path}: differs from recorded file contents`);

const template = JSON.parse(await read(join(sample, 'start/.codex/hooks.example.json')));
const original = JSON.parse(pre.before.files.find(file => file.path === '.codex/hooks.json').text);
for (const groups of Object.values(original.hooks)) {
  for (const group of groups) for (const handler of group.hooks) {
    const script = handler.command.split('/').at(-1);
    handler.command = `node "<PROJECT_ROOT>/.codex/hooks/${script}"`;
  }
}
assert.deepEqual(template, original, 'Template may adapt command paths only');
await assert.rejects(readFile(join(sample, 'start/.codex/hooks.json')), { code: 'ENOENT' }, 'The sample must not enable hooks automatically');
for (const name of ['events.jsonl', 'tool-events.jsonl']) await assert.rejects(readFile(join(sample, 'start/.codex/hooks', name)), { code: 'ENOENT' }, 'Runtime logs must not be bundled in the sample');

const temporaryParent = resolve(tmpdir());
const temporary = await mkdtemp(join(temporaryParent, 'codex-runtime-lab-'));
const run = (commandArgs, options = {}) => {
  const result = spawnSync(process.execPath, commandArgs, { cwd: temporary, encoding: 'utf8', timeout: 10000, windowsHide: true, ...options });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'Check process was terminated');
  return result;
};
const test = (path, succeeds) => {
  const result = run(['--test', path]);
  const output = result.stdout + result.stderr;
  assert.equal(result.status, succeeds ? 0 : 1, `${path}: unexpected exit status\n${output}`);
  assert.match(output, succeeds ? /(?:#|ℹ) pass 1(?:\r?\n|$)/ : /13\s*!==\s*30/);
  return result;
};
const hook = (script, event) => {
  const result = run([`.codex/hooks/${script}`], { input: JSON.stringify(event) });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
try {
  await cp(join(sample, 'start'), temporary, { recursive: true });
  const common = { cwd: temporary, session_id: 'local-script-check', turn_id: 'synthetic-turn' };
  const marker = hook('prompt-marker.mjs', { ...common, hook_event_name: 'UserPromptSubmit' });
  const markerLog = JSON.parse((await read(join(temporary, '.codex/hooks/events.jsonl'))).trim());
  assert.equal(markerLog.session_id, common.session_id);
  assert.match(markerLog.marker, /^HOOK-[a-f0-9-]{36}$/);
  assert(marker.hookSpecificOutput.additionalContext.includes(markerLog.marker));

  const patch = target => `*** Begin Patch\n*** Update File: ${target}\n@@\n-original\n+changed\n*** End Patch`;
  const preEvent = target => ({ ...common, hook_event_name: 'PreToolUse', tool_name: 'apply_patch', tool_use_id: 'synthetic-patch', tool_input: { command: patch(target) } });
  assert.equal(hook('tool-experiment.mjs', preEvent('.codex/hook-lab/protected.txt')).hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual(hook('tool-experiment.mjs', preEvent('.codex/hook-lab/allowed.txt')), {});

  const results = [test('.codex/hook-lab/pass.test.mjs', true), test('.codex/hook-lab/fail.test.mjs', false)];
  for (const [index, result] of results.entries()) {
    const fixture = index === 0 ? 'pass' : 'fail';
    assert.deepEqual(hook('tool-experiment.mjs', {
      ...common, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: `synthetic-${fixture}`,
      tool_input: { command: `node --test .codex/hook-lab/${fixture}.test.mjs` }, tool_response: result.stdout,
    }), {});
  }
  const toolEvents = (await read(join(temporary, '.codex/hooks/tool-events.jsonl'))).trim().split('\n').map(JSON.parse);
  assert.deepEqual(toolEvents.map(event => event.decision), ['deny', 'observe', 'observe']);
  for (const [index, result] of results.entries()) assert.equal(toolEvents[index + 1].tool_response, result.stdout);
  assert.equal(await read(join(temporary, '.codex/hook-lab/protected.txt')), normalize(expected.get('start/.codex/hook-lab/protected.txt')));

  for (const directory of ['patch-recovery', 'plan-state']) {
    test(`lab/${directory}/price.test.mjs`, false);
    await cp(join(sample, `results/lab/${directory}/price.ts`), join(temporary, `lab/${directory}/price.ts`));
    test(`lab/${directory}/price.test.mjs`, true);
  }
  console.log('Runtime Lab: source contents and template paths match; pass/fail controls and both start/result tests behave as expected. Hook checks use synthetic events in a temporary copy, not a Desktop experiment.');

  if (args.includes('--background')) {
    const began = performance.now();
    const result = run(['lab/background-delay.mjs'], { timeout: 55000 });
    assert.equal(result.status, 0, result.stderr);
    assert(performance.now() - began >= 35000, 'Background script must really wait 35 seconds');
    assert.match(result.stdout, /^BACKGROUND_START .+\r?\nBACKGROUND_TOTAL 27\r?\nBACKGROUND_DONE .+\r?\n$/);
    console.log('Runtime Lab background: waited 35 seconds, returned BACKGROUND_TOTAL 27 and exited 0.');
  }
} finally {
  // Delete only this process's verified temporary copy, never the real demo.
  assert.equal(dirname(resolve(temporary)), temporaryParent);
  assert(basename(temporary).startsWith('codex-runtime-lab-'));
  await rm(temporary, { recursive: true, force: true });
}
