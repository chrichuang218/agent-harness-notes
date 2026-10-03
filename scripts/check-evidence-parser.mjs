import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseTimeline, groupStages, sanitize, summarizeExperiment } from './collect-evidence.mjs';

const responseId = 'resp_exact_event_identifier';
const lines = [
  'Timestamp: 2026-09-29T23:47:00+08:00', 'Event: websocket.request',
  JSON.stringify({ type: 'response.create', input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Quoted resp_not_an_event' }] }] }),
  'Timestamp: 2026-09-29T23:47:01+08:00', 'Event: websocket.response',
  JSON.stringify({ type: 'response.created', response: { id: responseId } }),
  'Timestamp: 2026-09-29T23:47:02+08:00', 'Event: websocket.response',
  JSON.stringify({ type: 'response.output_item.done', item: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '你好' }] } }),
  'Timestamp: 2026-09-29T23:47:03+08:00', 'Event: websocket.response',
  JSON.stringify({ type: 'response.completed', response: { id: responseId, output: [], usage: { input_tokens: 7, output_tokens: 2 } } }),
];
const [stage] = groupStages(parseTimeline(lines, 'fixture.log'));
assert.equal(stage.responseId, responseId);
assert.equal(stage.request.line, 3);
assert.deepEqual(stage.completed.data.response.output, [], 'Never replace raw completed output with reconstructed output');
assert.equal(stage.events.filter(event => event.data.type === 'response.output_item.done').length, 1);
assert.equal(parseTimeline(lines, 'fixture.log', Date.parse('2026-09-29T23:47:04+08:00')).length, 0);
const microsecondRecords = [
  { timestamp: '2026-09-29T23:47:01.1239000+08:00', event: 'api.websocket.response', data: { type: 'response.completed', response: { id: responseId } }, line: 3 },
  { timestamp: '2026-09-29T23:47:01.1231000+08:00', event: 'api.websocket.request', data: { type: 'response.create' }, line: 19 },
];
assert.equal(groupStages(microsecondRecords)[0].responseId, responseId, 'Distinct CPA fragments can arrive inside the same millisecond');
const cleaned = sanitize({
  path: 'C:\\Users\\person\\.codex\\sessions',
  response_id: responseId, call_id: 'call_keep_identifier', input_tokens: 123,
  metadata: JSON.stringify({ installation_id: 'personal-id', session_id: 'session-keep', access_token: 'private-value' }),
  text: 'Authorization: Bearer veryLongPrivateToken1234 api_key=veryLongPrivateKey5678',
});
assert.equal(cleaned.path, '<USER_HOME>\\.codex\\sessions');
assert.equal(sanitize('read("C:\\\\Users\\\\person\\\\.codex")'), 'read("<USER_HOME>\\\\.codex")', 'Code strings may contain escaped Windows separators');
assert.equal(sanitize(JSON.stringify({ message: 'gAAAAA' + 'x'.repeat(80) + '=' })), '{"message":"<REDACTED>"}', 'Encrypted delegation envelopes are not public message text');
assert.equal(cleaned.response_id, responseId);
assert.equal(cleaned.call_id, 'call_keep_identifier');
assert.equal(cleaned.input_tokens, 123);
assert.equal(JSON.parse(cleaned.metadata).access_token, '<REDACTED>');
assert.equal(JSON.parse(cleaned.metadata).session_id, 'session-keep');
assert(!JSON.stringify(cleaned).includes('veryLongPrivate'));

async function verifyAdditionalEvidence(experiment, stages) {
  const sidecars = {};
  for (const key of ['auditFile', 'rolloutEventsFile', 'hookEventsFile', 'fileObservationsFile']) {
    if (!experiment[key]) continue;
    assert(experiment[key].startsWith(`evidence/desktop-lab/${experiment.id}/`), `${key}: unexpected experiment directory`);
    sidecars[key] = JSON.parse(await readFile(experiment[key], 'utf8'));
  }
  if (sidecars.auditFile?.markerChain?.hookEventFile) {
    const hookFile = sidecars.auditFile.markerChain.hookEventFile;
    assert(hookFile.startsWith(`evidence/desktop-lab/${experiment.id}/`));
    sidecars.hookEventsFile = JSON.parse(await readFile(hookFile, 'utf8'));
  }
  if (experiment.submission) {
    const first = stages[0].request;
    const metadata = JSON.parse(first.client_metadata['x-codex-turn-metadata']);
    assert.equal(metadata.turn_trigger, experiment.submission.turnTrigger);
    const expected = experiment.submission.method === 'computer-use-desktop-composer' ? 'composer' : 'app_tool_create_thread';
    assert.equal(metadata.turn_trigger, expected, `${experiment.id}: submission path must match CPA metadata`);
    const inputText = first.input.flatMap(item => [
      ...(item.content || []).map(part => part.text || ''),
      ...(typeof item.output === 'string' ? [item.output] : []),
    ]).join('\n');
    assert(inputText.includes(experiment.submission.submittedPrompt.trim()), `${experiment.id}: submitted prompt missing from recorded input`);
  }
  const nativeEvents = sidecars.rolloutEventsFile?.events || [];
  if (sidecars.rolloutEventsFile) {
    assert(nativeEvents.length > 0);
    for (const { sourceLine, event } of nativeEvents) {
      assert(Number.isInteger(sourceLine) && sourceLine > 0);
      if (event.payload.turn_id) assert(experiment.turnIds.includes(event.payload.turn_id));
    }
    const nativeResponses = nativeEvents.filter(({ event }) => event.type === 'token_usage_record').map(({ event }) => event.payload.response_id);
    assert.deepEqual(nativeResponses.sort(), experiment.stages.filter(stage => !stage.prewarm).map(stage => stage.responseId).sort());
    const nativeCalls = nativeEvents.filter(({ event }) => event.type === 'response_item' && /(?:function|custom_tool)_call$/.test(event.payload.type)).map(({ event }) => event.payload);
    const cpaCalls = stages.flatMap(stage => stage.items).filter(item => /(?:function|custom_tool)_call$/.test(item.type));
    assert.equal(nativeCalls.length, cpaCalls.length, `${experiment.id}: native and CPA call counts differ`);
    for (const call of cpaCalls) {
      const native = nativeCalls.find(item => item.call_id === call.call_id);
      assert(native, `${experiment.id}: native call missing ${call.call_id}`);
      for (const key of ['type', 'name', 'input', 'arguments']) assert.deepEqual(native[key], call[key]);
    }
    for (const turn of experiment.turnIds) assert(nativeEvents.some(({ event }) => event.payload.type === 'task_complete' && event.payload.turn_id === turn));
  }
  const hookEvents = sidecars.hookEventsFile?.events || sidecars.hookEventsFile?.sources?.flatMap(source => source.events) || [];
  for (const { sourceLine, event } of hookEvents) {
    assert(sourceLine > 0);
    assert.equal(event.session_id, experiment.threadId);
    assert(experiment.turnIds.includes(event.turn_id));
    if (event.event === 'UserPromptSubmit') {
      assert(stages.some(({ request }) => request.input.some(item => item.role === 'developer' && item.content?.some(part => part.text?.includes(event.marker)))), `${experiment.id}: Hook marker missing from developer input`);
    } else if (event.event === 'PostToolUse') {
      const native = nativeEvents.find(({ event: row }) => row.payload.item?.id === event.tool_use_id)?.event.payload.item;
      assert.equal(native?.type, 'CommandExecution');
      assert.equal(native.stdout, event.tool_response, `${experiment.id}: Hook and native stdout differ`);
      const returned = stages.flatMap(({ request }) => request.input).flatMap(item => Array.isArray(item.output) ? item.output : []).flatMap(part => {
        if (!part.text?.startsWith('{')) return [];
        try { return [JSON.parse(part.text)]; } catch { return []; }
      }).find(result => result.output === event.tool_response);
      assert(returned, `${experiment.id}: Hook stdout missing from CPA tool result`);
      assert.equal(returned.exit_code, native.exit_code);
    } else if (event.event === 'PreToolUse') {
      assert.equal(event.decision, 'deny');
      assert(stages.some(({ request }) => JSON.stringify(request.input).includes('Command blocked by PreToolUse hook')));
    }
  }
  // Hash the recorded file contents, not the current external demo directory.
  function verifySnapshot(value) {
    if (!value || typeof value !== 'object') return;
    const text = value.text ?? value.content;
    if (value.sha256 && typeof text === 'string') {
      assert.match(value.sha256, /^[a-f0-9]{64}$/);
      assert.equal(createHash('sha256').update(text).digest('hex'), value.exportedTextSha256, 'Public snapshot contents do not match their hash');
    }
    if (typeof value.changed === 'boolean') assert.equal(value.changed, value.before !== value.after);
    for (const child of Object.values(value)) verifySnapshot(child);
  }
  verifySnapshot(sidecars.fileObservationsFile);
  if (experiment.coverage === 'text-progress-only') {
    const context = nativeEvents.find(({ event }) => event.type === 'turn_context')?.event.payload;
    assert.equal(context?.collaboration_mode.mode, 'default');
    assert(!nativeEvents.some(({ event }) => /plan/i.test(event.payload.item?.type || event.payload.type || '')));
    assert.equal(sidecars.auditFile.nativePlanCallsObserved, 0);
    assert.equal(sidecars.auditFile.progressKind, 'assistant commentary text');
  }
  return Object.keys(sidecars).length;
}

// Missing linked evidence must fail; only an absent catalog can skip export checks.
async function verifyExports(catalog) {
  let checked = 0;
  const responseIds = new Set(catalog.experiments.flatMap(experiment => experiment.stages.map(stage => stage.responseId)));
  assert.equal(responseIds.size, catalog.experiments.reduce((sum, experiment) => sum + experiment.stages.length, 0), 'Response ids must identify unique stages');
  for (const experiment of catalog.experiments) {
    if (experiment.manifestFile) {
      const manifest = JSON.parse(await readFile(experiment.manifestFile, 'utf8'));
      assert.equal(manifest.id, experiment.id);
      assert.equal(manifest.sanitization.changedPaths.length, experiment.sanitization.changedPathCount);
      assert.deepEqual(summarizeExperiment(manifest), experiment, `${experiment.id}: index and manifest differ`);
    }
    if (experiment.compactionFile) {
      const compaction = JSON.parse(await readFile(experiment.compactionFile, 'utf8'));
      assert.equal(experiment.requestKind, 'compaction');
      assert(compaction.events.length > 0);
      for (const { event, sourceLine } of compaction.events) {
        assert.equal(event.type, 'compacted');
        assert(sourceLine > 0);
        assert(experiment.stages.some(stage => stage.responseId === event.payload.compaction_response_id));
        assert(Array.isArray(event.payload.replacement_history));
      }
      checked++;
    }
    if (experiment.interruptionFile) {
      const interruption = JSON.parse(await readFile(experiment.interruptionFile, 'utf8'));
      assert.equal(experiment.status, 'interrupted');
      assert.equal(experiment.reply, '');
      for (const turn of interruption.turns) {
        assert(experiment.turnIds.includes(turn.turnId));
        assert.equal(turn.events.at(-1).event.payload.type, 'turn_aborted');
        assert(!turn.events.some(({ event }) => event.payload.type === 'task_complete'));
      }
      checked++;
    }
    const stages = [];
    for (const exported of experiment.stages) {
      for (const key of ['requestFile', 'responseFile', 'eventsFile', 'upstreamFile', 'outputItemsFile']) {
        if (exported[key]) { JSON.parse(await readFile(exported[key], 'utf8')); checked++; }
      }
      const completion = JSON.parse(await readFile(exported.responseFile, 'utf8'));
      assert.equal(completion.type, 'response.completed');
      assert.equal(completion.response.id, exported.responseId);
      const events = JSON.parse(await readFile(exported.eventsFile, 'utf8'));
      assert(events.every(event => event.data?.type?.startsWith('response.')), `${exported.eventsFile}: transport headers or non-response events must not be published`);
      assert.deepEqual(completion, events.findLast(event => event.data.type === 'response.completed')?.data, `${experiment.id}: completed response differs from its event`);
      const request = JSON.parse(await readFile(exported.requestFile, 'utf8'));
      const items = JSON.parse(await readFile(exported.outputItemsFile, 'utf8')).items;
      assert.deepEqual(items, events.filter(event => event.data.type === 'response.output_item.done').map(event => event.data.item), `${experiment.id}: derived output differs from events`);
      stages.push({ request, items, completion });
      assert.equal(request.client_metadata.thread_id, experiment.threadId);
      assert.equal(exported.prewarm, request.generate === false, `${exported.requestFile}: prewarm label must match the request`);
      if (request.previous_response_id) assert(responseIds.has(request.previous_response_id), `${exported.requestFile}: referenced response is missing from the public dataset`);
      if (!exported.prewarm) assert(experiment.turnIds.includes(request.client_metadata.turn_id));
    }
    if (experiment.stats) {
      const formal = stages.filter(({ request }) => request.generate !== false);
      assert.equal(experiment.stats.requests, formal.length);
      assert.equal(experiment.stats.prewarms, stages.length - formal.length);
      assert.equal(experiment.stats.toolCalls, formal.flatMap(stage => stage.items).filter(item => /(?:function|custom_tool)_call$/.test(item.type)).length);
      for (const [key, field] of [['inputTokens', 'input_tokens'], ['outputTokens', 'output_tokens']]) {
        assert.equal(experiment.stats[key], formal.reduce((sum, { completion }) => sum + (completion.response.usage?.[field] || 0), 0));
      }
    }
    checked += await verifyAdditionalEvidence(experiment, stages);
    for (const file of await readdir(join('evidence/desktop-lab', experiment.id))) {
      const text = await readFile(join('evidence/desktop-lab', experiment.id, file), 'utf8');
      assert(!/[A-Za-z]:[\\/]+Users[\\/]+(?!<)[^\\/\s"<>]+/.test(text), `${file}: unredacted Windows user root`);
      assert(!/"(?:authorization|access_token|refresh_token|api_key)"\s*:\s*"(?!<REDACTED>)[^"]+"/i.test(text), `${file}: credential field`);
      if (experiment.submission && file.endsWith('.json')) assert.deepEqual(sanitize(JSON.parse(text)), JSON.parse(text), `${file}: public evidence is not fully sanitized`);
    }
  }
  return checked;
}

await assert.rejects(
  verifyExports({ experiments: [{ stages: [{ requestFile: 'evidence/desktop-lab/__missing_export_fixture__/request.json' }] }] }),
  { code: 'ENOENT' },
  'An existing catalog must not accept missing linked evidence',
);
await assert.rejects(
  verifyAdditionalEvidence({ id: '__missing_export_fixture__', auditFile: 'evidence/desktop-lab/__missing_export_fixture__/audit.json' }, []),
  { code: 'ENOENT' },
  'New audit references must fail when the referenced file is absent',
);
const summaryFixture = { id: 'fixture', stages: [], notes: ['keep'], flags: { keep: true }, sanitization: { mode: 'fixture', changedPaths: ['a', 'b'] } };
const summary = summarizeExperiment(summaryFixture);
assert.equal(summary.manifestFile, 'evidence/desktop-lab/fixture/manifest.json');
assert.equal(summary.sanitization.changedPathCount, 2);
assert(!('changedPaths' in summary.sanitization));
assert.deepEqual(summary.stages, summaryFixture.stages);
assert.deepEqual(summary.notes, summaryFixture.notes);
assert.deepEqual(summary.flags, summaryFixture.flags);
assert.deepEqual(summarizeExperiment(summary), summary, 'Repeated collection must preserve summary counts');

let catalog;
try { catalog = JSON.parse(await readFile('evidence/desktop-lab/index.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (catalog) {
  const checked = await verifyExports(catalog);
  console.log(`Evidence parser, redaction, exact-id matching and ${checked} exported JSON files verified.`);
} else {
  console.log('Evidence parser fixtures verified; export checks skipped because evidence/desktop-lab/index.json does not exist.');
}
