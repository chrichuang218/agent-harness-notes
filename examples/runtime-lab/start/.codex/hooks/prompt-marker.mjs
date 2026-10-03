import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const event = JSON.parse(input);
if (event.hook_event_name !== 'UserPromptSubmit') {
  throw new Error('Expected UserPromptSubmit');
}

const marker = `HOOK-${randomUUID()}`;
// Record identifiers only; never copy prompts or conversation contents.
appendFileSync(new URL('./events.jsonl', import.meta.url), JSON.stringify({
  timestamp: new Date().toISOString(),
  event: event.hook_event_name,
  session_id: event.session_id ?? null,
  turn_id: event.turn_id ?? null,
  marker,
}) + '\n', 'utf8');

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: `本轮实验编号为 ${marker}。这是本轮 UserPromptSubmit Hook 自动生成并注入的编号。`,
  },
}));
