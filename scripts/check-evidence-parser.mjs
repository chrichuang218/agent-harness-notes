import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
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

// Missing linked evidence must fail; only an absent catalog can skip export checks.
async function verifyExports(catalog) {
  let checked = 0;
  const responseIds = new Set(catalog.experiments.flatMap(experiment => experiment.stages.map(stage => stage.responseId)));
  for (const experiment of catalog.experiments) {
    if (experiment.manifestFile) {
      const manifest = JSON.parse(await readFile(experiment.manifestFile, 'utf8'));
      assert.equal(manifest.id, experiment.id);
      assert.equal(manifest.sanitization.changedPaths.length, experiment.sanitization.changedPathCount);
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
    for (const exported of experiment.stages) {
      for (const key of ['requestFile', 'responseFile', 'eventsFile', 'upstreamFile', 'outputItemsFile']) {
        if (exported[key]) { JSON.parse(await readFile(exported[key], 'utf8')); checked++; }
      }
      const completion = JSON.parse(await readFile(exported.responseFile, 'utf8'));
      assert.equal(completion.type, 'response.completed');
      assert.equal(completion.response.id, exported.responseId);
      const events = JSON.parse(await readFile(exported.eventsFile, 'utf8'));
      assert(events.every(event => event.data?.type?.startsWith('response.')), `${exported.eventsFile}: transport headers or non-response events must not be published`);
      const request = JSON.parse(await readFile(exported.requestFile, 'utf8'));
      assert.equal(request.client_metadata.thread_id, experiment.threadId);
      assert.equal(exported.prewarm, request.generate === false, `${exported.requestFile}: prewarm label must match the request`);
      if (request.previous_response_id) assert(responseIds.has(request.previous_response_id), `${exported.requestFile}: referenced response is missing from the public dataset`);
      if (!exported.prewarm) assert(experiment.turnIds.includes(request.client_metadata.turn_id));
    }
    for (const file of await readdir(join('evidence/desktop-lab', experiment.id))) {
      const text = await readFile(join('evidence/desktop-lab', experiment.id, file), 'utf8');
      assert(!/[A-Za-z]:\\+Users\\+(?!<)[^\\\s"]+/.test(text), `${file}: unredacted Windows user root`);
      assert(!/"(?:authorization|access_token|refresh_token|api_key)"\s*:\s*"(?!<REDACTED>)[^"]+"/i.test(text), `${file}: credential field`);
    }
  }
  return checked;
}

await assert.rejects(
  verifyExports({ experiments: [{ stages: [{ requestFile: 'evidence/desktop-lab/__missing_export_fixture__/request.json' }] }] }),
  { code: 'ENOENT' },
  'An existing catalog must not accept missing linked evidence',
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
