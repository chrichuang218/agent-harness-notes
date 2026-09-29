#!/usr/bin/env node
// Read CPA files without changing them. Export only JSON bodies, never HTTP headers.
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat, open, mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve, relative, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultLogs = 'E:/Develop/CPA-Stack/runtime/cli-proxy-api/auth/logs';
const slash = value => value.replaceAll('\\', '/');
const messageText = item => (item.content ?? []).map(part => part.text ?? '').join('\n');

export function parseTimeline(lines, source, minTime = -Infinity, maxTime = Infinity) {
  let timestamp = '', event = '', lineNumber = 0;
  const records = [];
  for (const line of lines) {
    lineNumber++;
    if (line.startsWith('Timestamp: ')) timestamp = line.slice(11).trim();
    else if (line.startsWith('Event: ')) event = line.slice(7).trim();
    else if (line.startsWith('=== ')) event = '';
    else if (line.startsWith('{') && /^(api\.)?websocket\.(request|response)$/.test(event)) {
      if (Date.parse(timestamp) < minTime || Date.parse(timestamp) > maxTime) continue;
      const data = JSON.parse(line);
      records.push({ timestamp, event, data, source, line: lineNumber });
    }
  }
  return records;
}

// A quoted response id inside a prompt is not evidence. Only actual response events identify a stage.
export function groupStages(records) {
  const stages = [];
  let stage;
  for (const record of records.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.timestamp.localeCompare(b.timestamp) || a.line - b.line)) {
    if (record.data.type === 'response.create' && record.event.endsWith('.request')) {
      stage = { request: record, events: [], responseId: null };
      stages.push(stage);
    } else if (stage && record.event.endsWith('.response')) {
      stage.events.push(record);
      if (/^response\.(created|in_progress|completed|failed|incomplete)$/.test(record.data.type)) {
        const id = record.data.response?.id;
        if (stage.responseId && id && id !== stage.responseId) throw new Error('Overlapping response ids in one CPA stream');
        if (id) stage.responseId = id;
      }
      if (record.data.type === 'response.completed') stage.completed = record;
    }
  }
  return stages;
}

const secretKey = /^(?:authorization|proxy-authorization|cookie|set-cookie|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|client[-_]?secret|password|secret|safety_identifier|installation_id|x-codex-installation-id|encrypted_content|obfuscation)$/i;

export function sanitize(value, changes = new Set(), location = '$') {
  if (typeof value === 'string') {
    let text = value;
    // Some metadata and tool arguments are JSON encoded inside a JSON string.
    if (/^\s*[\[{]/.test(text)) {
      try { const inner = JSON.parse(text); return JSON.stringify(sanitize(inner, changes, location)); } catch {}
    }
    text = text.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"<>]+/gi, '<USER_HOME>');
    text = text.replace(/\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, '<REDACTED>');
    text = text.replace(/\bgAAAAA[A-Za-z0-9_-]{60,}={0,2}/g, '<REDACTED>');
    text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi, 'Bearer <REDACTED>');
    text = text.replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[=:]\s*["']?)[A-Za-z0-9._~+\/-]{12,}/gi, '$1<REDACTED>');
    if (text !== value) changes.add(location);
    return text;
  }
  if (Array.isArray(value)) return value.map((item, i) => sanitize(item, changes, `${location}[${i}]`));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (secretKey.test(key) && item != null) { changes.add(`${location}.${key}`); return [key, '<REDACTED>']; }
    return [key, sanitize(item, changes, `${location}.${key}`)];
  }));
  return value;
}

async function readTimeline(file, minTime, maxTime) {
  const lines = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const selected = [];
  let timestamp = '', event = '', line = 0;
  for await (const text of lines) {
    line++;
    if (text.startsWith('Timestamp: ')) timestamp = text.slice(11).trim();
    else if (text.startsWith('Event: ')) event = text.slice(7).trim();
    else if (text.startsWith('=== ')) event = '';
    else if (text.startsWith('{') && /^(api\.)?websocket\.(request|response)$/.test(event) && Date.parse(timestamp) >= minTime && Date.parse(timestamp) <= maxTime) {
      try { selected.push({ timestamp, event, data: JSON.parse(text), source: file, line }); }
      catch (error) { throw new Error(`Invalid or incomplete JSON at ${basename(file)}:${line}: ${error.message}`); }
    }
  }
  return selected;
}

async function findRollout(thread, supplied) {
  if (supplied) return resolve(supplied);
  if (!thread) throw new Error('Supply --thread or --rollout');
  const sessions = join(process.env.USERPROFILE ?? process.env.HOME, '.codex', 'sessions');
  // UUIDv7 timestamps are UTC; Desktop's session directory uses the local date.
  // Search the adjacent UTC dates too, covering midnight and timezone differences without a recursive scan.
  const created = parseInt(thread.replaceAll('-', '').slice(0, 12), 16);
  const dates = [-86400000, 0, 86400000].map(offset => new Date(created + offset).toISOString().slice(0, 10).replaceAll('-', '/'));
  const matches = [];
  for (const date of dates) {
    const directory = join(sessions, date);
    try { matches.push(...(await readdir(directory)).filter(name => name.endsWith(`${thread}.jsonl`)).map(name => join(directory, name))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (matches.length !== 1) throw new Error(`Expected one rollout for ${thread}; found ${matches.length}. Supply --rollout.`);
  return matches[0];
}

async function collectStreams(logRoot, start, end, thread) {
  const streams = [];
  const entries = await readdir(logRoot, { withFileTypes: true });
  let filesRead = 0;
  for (const entry of entries) {
    const file = join(logRoot, entry.name);
    if (entry.isDirectory() && /^request-log-parts-(?:api-)?websocket-timeline-/.test(entry.name)) {
      const folderInfo = await stat(file);
      if (folderInfo.birthtimeMs > end || folderInfo.mtimeMs < start) continue;
      const records = [];
      for (const child of await readdir(file)) {
        if (!/^(request|part)-\d+\.tmp$/.test(child)) continue;
        const part = join(file, child);
        let info;
        try { info = await stat(part); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (info.birthtimeMs > end || info.mtimeMs < start) continue;
        try { records.push(...await readTimeline(part, start, end)); filesRead++; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      if (records.length) streams.push(records);
    } else if (entry.isFile() && /^v1-responses.*\.log$/.test(entry.name)) {
      const info = await stat(file);
      // Merged logs are created when the socket closes, possibly long after the turn.
      if (info.mtimeMs < start) continue;
      const handle = await open(file, 'r');
      const buffer = Buffer.alloc(2048);
      let header;
      try { const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0); header = buffer.subarray(0, bytesRead).toString(); }
      finally { await handle.close(); }
      const began = Date.parse(header.match(/^Timestamp: (.+)$/m)?.[1] ?? '');
      if (!Number.isFinite(began) || began > end) continue;
      const headerThread = header.match(/^Thread-Id: (.+)$/m)?.[1].trim();
      if (headerThread && headerThread !== thread) continue;
      const records = await readTimeline(file, start, end);
      filesRead++;
      for (const prefix of ['websocket.', 'api.websocket.']) {
        const side = records.filter(record => record.event.startsWith(prefix));
        if (side.length) streams.push(side);
      }
    }
  }
  return { streams, filesRead };
}

export function summarizeExperiment(entry) {
  const { changedPaths, ...sanitization } = entry.sanitization;
  return {
    ...entry,
    manifestFile: `evidence/desktop-lab/${entry.id}/manifest.json`,
    sanitization: { ...sanitization, changedPathCount: changedPaths?.length ?? sanitization.changedPathCount },
  };
}

export async function collect(options) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.id ?? '')) throw new Error('--id must contain lowercase letters, digits and hyphens');
  const rollout = await findRollout(options.thread, options.rollout);
  const rows = (await readFile(rollout, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
  const thread = rows.find(row => row.type === 'session_meta')?.payload.id;
  if (!thread || options.thread && options.thread !== thread) throw new Error('Rollout thread id does not match --thread');
  const turnIds = options.turn?.split(',') ?? rows.filter(row => row.payload.type === 'task_complete' || options['allow-interrupted'] && row.payload.type === 'turn_aborted').slice(-1).map(row => row.payload.turn_id);
  if (!turnIds.length) throw new Error('No completed turn to collect');
  const turns = [];
  for (const id of turnIds) {
    const startIndex = rows.findIndex(row => row.payload.type === 'task_started' && row.payload.turn_id === id);
    const endIndex = rows.findIndex(row => (row.payload.type === 'task_complete' || options['allow-interrupted'] && row.payload.type === 'turn_aborted') && row.payload.turn_id === id);
    if (startIndex < 0 || endIndex < startIndex) throw new Error(`Turn ${id} has not completed`);
    turns.push(rows.slice(startIndex, endIndex + 1));
  }
  const wanted = new Set(turns.flat().filter(row => row.type === 'token_usage_record').map(row => row.payload.response_id));
  if (!wanted.size) throw new Error('No token_usage_record response ids in selected turns');
  const start = Math.min(...turns.map(turn => Date.parse(turn[0].timestamp))) - 60000;
  const end = Math.max(...turns.map(turn => Date.parse(turn.at(-1).timestamp))) + 10000;
  const logRoot = resolve(options.logs ?? defaultLogs);
  const { streams, filesRead } = await collectStreams(logRoot, start, end, thread);
  const all = streams.flatMap(groupStages);
  const client = new Map(), upstream = new Map();
  for (const stage of all) {
    if (!stage.completed || !stage.responseId) continue;
    const metadata = stage.request.data.client_metadata ?? {};
    const isPrewarm = options['include-prewarm'] && stage.request.data.generate === false && metadata.thread_id === thread;
    if (!wanted.has(stage.responseId) && !isPrewarm) continue;
    if (metadata.thread_id && metadata.thread_id !== thread) throw new Error('Response id matched another thread');
    const target = stage.request.event.startsWith('api.') ? upstream : client;
    const existing = target.get(stage.responseId);
    if (existing && JSON.stringify(existing.request.data) !== JSON.stringify(stage.request.data)) throw new Error('Conflicting copies of the same request');
    target.set(stage.responseId, stage);
  }
  for (const id of wanted) {
    if (!client.has(id)) throw new Error(`Missing completed CPA client stage ${id}; no export written`);
    if (!upstream.has(id)) throw new Error(`Missing completed CPA upstream stage ${id}; no export written`);
  }
  const outputRoot = join(repo, 'evidence', 'desktop-lab');
  const output = join(outputRoot, options.id);
  const changes = new Set();
  const write = async (name, value) => {
    const file = join(output, name);
    await writeFile(file, JSON.stringify(sanitize(value, changes, name), null, 2) + '\n');
    return slash(relative(repo, file));
  };
  await mkdir(output, { recursive: true });
  const stages = [];
  let requests = 0, toolCalls = 0, inputTokens = 0, outputTokens = 0, prewarms = 0;
  for (const [index, stage] of [...client.values()].sort((a, b) => Date.parse(a.request.timestamp) - Date.parse(b.request.timestamp)).entries()) {
    const id = `${String(index).padStart(2, '0')}-${stage.request.data.generate === false ? 'prewarm' : 'request'}`;
    const server = upstream.get(stage.responseId);
    const outputItems = stage.events.filter(record => record.data.type === 'response.output_item.done').map(record => record.data.item);
    if (stage.request.data.generate === false) prewarms++;
    else {
      requests++;
      toolCalls += outputItems.filter(item => /(?:function|custom_tool)_call$/.test(item.type)).length;
      inputTokens += stage.completed.data.response.usage?.input_tokens ?? 0;
      outputTokens += stage.completed.data.response.usage?.output_tokens ?? 0;
    }
    const sourceRecord = record => record ? { file: slash(relative(logRoot, record.source)), line: record.line, timestamp: record.timestamp } : null;
    // Transport metadata can contain auth cookies. Export the response protocol only.
    const protocolEvents = stage.events.filter(record => record.data.type.startsWith('response.')).map(record => ({ timestamp: record.timestamp, sourceLine: record.line, data: record.data }));
    stages.push({
      id,
      requestFile: await write(`${id}.request.json`, stage.request.data),
      responseFile: await write(`${id}.response.json`, stage.completed.data),
      eventsFile: await write(`${id}.events.json`, protocolEvents),
      upstreamFile: server ? await write(`${id}.upstream.json`, server.request.data) : null,
      outputItemsFile: await write(`${id}.output-items.json`, { provenance: 'Derived by collecting response.output_item.done.item in event order; response.completed is unchanged.', items: outputItems }),
      requestTimestamp: stage.request.timestamp,
      responseId: stage.responseId,
      previousResponseId: stage.request.data.previous_response_id ?? null,
      inputCount: stage.request.data.input?.length ?? 0,
      prewarm: stage.request.data.generate === false,
      source: { request: sourceRecord(stage.request), completed: sourceRecord(stage.completed), upstream: sourceRecord(server?.request) },
    });
  }
  const prompt = turns.map(turn => turn.filter(row => row.type === 'response_item' && row.payload.role === 'user').map(row => messageText(row.payload)).filter(text => !text.startsWith('<') && !text.startsWith('# AGENTS.md')).at(-1) ?? '').join('\n\n');
  const reply = turns.map(turn => turn.at(-1).payload.last_agent_message ?? '').join('\n\n');
  const compacted = turns.flat().filter(row => row.type === 'compacted' && wanted.has(row.payload.compaction_response_id));
  const compactionFile = compacted.length ? await write('compaction.json', {
    provenance: 'Native compacted events from the local rollout, matched by compaction_response_id. No encrypted content is exported.',
    source: slash(rollout),
    events: compacted.map(row => ({ sourceLine: rows.indexOf(row) + 1, event: row })),
  }) : undefined;
  const interruptedTurns = turns.filter(turn => turn.at(-1).payload.type === 'turn_aborted');
  const interruptionFile = interruptedTurns.length ? await write('interruption.json', {
    provenance: 'Selected native rollout events for explicitly interrupted turns. Completed model responses do not imply that the user turn or its outstanding tools completed.',
    source: slash(rollout),
    turns: interruptedTurns.map(turn => ({
      turnId: turn.at(-1).payload.turn_id,
      events: turn.filter(row => ['task_started', 'turn_aborted'].includes(row.payload.type)
        || row.type === 'response_item' && ['message', 'function_call', 'custom_tool_call', 'function_call_output', 'custom_tool_call_output'].includes(row.payload.type)
        || row.payload.type === 'item_completed' && row.payload.item?.type === 'CommandExecution')
        .map(row => ({ sourceLine: rows.indexOf(row) + 1, event: row })),
    })),
  }) : undefined;
  const entry = {
    id: options.id, title: options.title ?? options.id, threadId: thread, turnIds, prompt, reply,
    ...(compactionFile ? { requestKind: 'compaction', compactionFile } : {}),
    ...(interruptionFile ? { status: 'interrupted', interruptionFile } : {}),
    stats: { requests, toolCalls, inputTokens, outputTokens, prewarms }, stages,
    notes: [
      'Matched exact response event ids against rollout token_usage_record.response_id; text mentions are not matches.',
      'response.json preserves the recorded response.completed event. Its output may be empty; output-items.json is a separately labelled derivation.',
      'Only JSON request bodies and response.* events are exported. HTTP headers and transport header events are omitted.',
      'Counts exclude prewarm stages. Token usage is the sum of formal model responses, not unique context size.',
      ...(compactionFile ? ['This turn was a native compaction operation. Empty prompt/reply fields reflect the absence of ordinary chat messages; inspect request metadata and compactionFile for the trigger and replacement history.'] : []),
      ...(interruptionFile ? ['The user turn ended with native turn_aborted. Exported response.completed events belong only to model calls that finished before interruption; no task_complete or final reply is synthesized. In-flight model calls without usage records are outside this collector mode.'] : []),
    ],
    sanitization: { mode: 'structure-preserving-redaction', replacements: ['Windows user home → <USER_HOME>', 'Credential values, encrypted content, installation and safety ids → <REDACTED>'], changedPaths: [...changes].sort() },
    rolloutSource: slash(rollout), collectedAt: new Date().toISOString(),
  };
  const cleanEntry = sanitize(entry);
  await writeFile(join(output, 'manifest.json'), JSON.stringify(cleanEntry, null, 2) + '\n');
  const indexFile = join(outputRoot, 'index.json');
  let catalog = { experiments: [] };
  try { catalog = JSON.parse(await readFile(indexFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  catalog.experiments = catalog.experiments.filter(experiment => experiment.id !== options.id).concat(cleanEntry).map(summarizeExperiment).sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(indexFile, JSON.stringify(catalog, null, 2) + '\n');
  return { id: options.id, threadId: thread, turnIds, stats: entry.stats, filesRead, output: slash(output), stages: stages.map(stage => ({ id: stage.id, responseId: stage.responseId, inputCount: stage.inputCount })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { thread: { type: 'string' }, rollout: { type: 'string' }, turn: { type: 'string' }, id: { type: 'string' }, title: { type: 'string' }, logs: { type: 'string' }, 'include-prewarm': { type: 'boolean' }, 'allow-interrupted': { type: 'boolean' }, help: { type: 'boolean' } } });
  if (values.help) console.log('node scripts/collect-evidence.mjs --thread UUID --turn UUID[,UUID] --id 01-hello --title "你好" [--include-prewarm] [--allow-interrupted] [--rollout FILE] [--logs DIRECTORY]\nWhen --turn is omitted, exports the latest completed turn (or interrupted turn with --allow-interrupted). Source logs are never modified. Review exports before publication.');
  else collect(values).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
