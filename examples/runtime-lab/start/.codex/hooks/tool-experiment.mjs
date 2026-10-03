import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const event = JSON.parse(input);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const normalize = value => path.resolve(value).toLowerCase();
const command = event.tool_input?.command ?? event.tool_input?.cmd;
let decision;
let output = {};

// This experiment intercepts apply_patch only, not every possible write method.
if (event.hook_event_name === 'PreToolUse' && event.tool_name === 'apply_patch') {
  if (typeof command !== 'string' || typeof event.cwd !== 'string') {
    throw new Error('Expected patch command and cwd');
  }
  const protectedFile = normalize(path.join(root, '.codex/hook-lab/protected.txt'));
  const paths = [...command.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)];
  if (!paths.some(match => normalize(path.resolve(event.cwd, match[1].trim())) === protectedFile)) {
    console.log('{}');
    process.exit(0);
  }
  decision = 'deny';
  output = { hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'HOOK-LAB: apply_patch may not change .codex/hook-lab/protected.txt. Report the denial; do not retry using another write method.',
  }};
} else if (event.hook_event_name === 'PostToolUse' && event.tool_name === 'Bash') {
  if (typeof command !== 'string') throw new Error('Expected command text');
  if (!/(?:^|[ /"'])\.codex\/hook-lab\/(?:pass|fail)\.test\.mjs(?=[\s"']|$)/i.test(command.replaceAll('\\', '/'))) {
    console.log('{}');
    process.exit(0);
  }
  if (!Object.hasOwn(event, 'tool_response')) throw new Error('Missing tool_response');
  decision = 'observe';
} else {
  throw new Error('Unexpected hook event or tool');
}

// Only matched experiment calls are logged. PostToolUse never changes results.
appendFileSync(new URL('./tool-events.jsonl', import.meta.url), JSON.stringify({
  timestamp: new Date().toISOString(),
  event: event.hook_event_name,
  session_id: event.session_id ?? null,
  turn_id: event.turn_id ?? null,
  tool_use_id: event.tool_use_id ?? null,
  tool_name: event.tool_name,
  decision,
  ...(decision === 'observe' ? { tool_response: event.tool_response } : {}),
}) + '\n', 'utf8');
console.log(JSON.stringify(output));
