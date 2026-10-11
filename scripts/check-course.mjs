import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { marked } from 'marked';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Validate the public course and its explicit references, never arbitrary paths
// inside historical prompts, private source metadata, or archived evidence.
const root = resolve('.');
const failures = [];
let linksChecked = 0;
let jsonChecked = 0;
let experimentCount = 0;
let stageCount = 0;
let screenshotCount = 0;
let screenshotChapterCount = 0;
const preservedLessonIds = [
  '01-request', '02-tools', '03-agent-loop', '04-session', '05-context',
  '06-agents', '07-skills', '08-memory', '09-mcp', '10-permissions',
  '11-plan', '12-multi-agent', '13-autonomy', '14-streaming', '15-architecture',
];
const preservedLegacyRoutes = {
  '01-hello': '01-request', '02-context': '04-session', '03-readme': '02-tools',
  '04-agents': '06-agents', '05-skills': '07-skills', '06-tests': '03-agent-loop',
  '07-fix': '03-agent-loop', '08-session': '04-session', '09-context': '05-context',
  '10-compaction': '05-context', '11-cache': '05-context', '12-memory': '08-memory',
  '13-mcp': '09-mcp', '14-plan': '11-plan', '15-permissions': '10-permissions',
  '16-multi-agent': '12-multi-agent', '17-goal': '13-autonomy',
  '18-streaming': '14-streaming', '19-recovery': '13-autonomy', '20-interruption': '13-autonomy',
};
// Published v0.5.0 stages remain addressable when later experiments are added.
const preservedStages = {
  '01-hello': ['00-prewarm', '01-request'],
  '02-context': ['00-request'],
  '03-readme': ['00-request', '01-request'],
  '04-agents': ['00-request', '01-request'],
  '05-skills': ['00-request', '01-request'],
  '06-tests': ['00-request', '01-request'],
  '07-fix': ['00-request', '01-request', '02-request', '03-request', '04-request'],
  '08-session-new': ['00-request'],
  '08-session-resume': ['00-request'],
  '08-session-seed': ['00-request'],
  '10-compaction': ['00-request'],
  '10-compaction-check': ['00-request'],
  '12-memory-read': ['00-request', '01-request'],
  '12-memory-write': ['00-request', '01-request', '02-request', '03-request', '04-request'],
  '13-mcp': ['00-request', '01-request', '02-request'],
  '14-plan': ['00-request', '01-request', '02-request', '03-request', '04-request', '05-request'],
  '14-plan-implement': ['00-request', '01-request', '02-request', '03-request'],
  '15-permissions': ['00-request', '01-request'],
  '16-agent-a': ['00-prewarm', '00-request', '01-request', '02-request', '03-request'],
  '16-agent-b': ['00-prewarm', '00-request', '01-request', '02-request'],
  '16-multi-agent': ['00-request', '01-request', '02-request', '03-request', '04-request'],
  '17-goal': ['00-request', '01-request', '02-request', '03-request', '04-request'],
  '19-recovery': ['00-request', '01-request', '02-request', '03-request'],
  '20-interrupted': ['00-request', '01-request'],
  '20-resume': ['00-request', '01-request'],
  '20-uninterrupted-control': ['00-request', '01-request', '02-request', '03-request'],
};
const check = (condition, message) => { if (!condition) failures.push(message); };
check(Object.keys(preservedStages).length === 26 && Object.values(preservedStages).flat().length === 74, 'The preserved v0.5.0 stage list must contain 26 experiments and 74 stages.');
async function exists(path) { try { return await stat(path); } catch { return null; } }
async function readJson(path) {
  try { const value = JSON.parse(await readFile(path, 'utf8')); jsonChecked++; return value; }
  catch (error) { failures.push(`${path}: ${error.message}`); return null; }
}
async function jsonFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await jsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push(path);
  }
  return result;
}
function localTarget(href, from) {
  if (!href || href.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return null;
  const path = decodeURIComponent(href.split(/[?#]/)[0]);
  if (/<[A-Z][A-Z_\d-]*>/.test(path)) return null;
  return resolve(dirname(from), path);
}
async function documentLinks(file) {
  let text;
  try { text = await readFile(file, 'utf8'); }
  catch (error) { failures.push(`${file}: ${error.message}`); return { text: '', targets: [] }; }
  const links = [];
  marked.walkTokens(marked.lexer(text), token => {
    if (token.type === 'link' || token.type === 'image') links.push(token.href);
    if (token.type === 'html') for (const match of token.raw.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g)) links.push(match[1]);
  });
  const targets = [];
  for (const href of links) {
    let target;
    try { target = localTarget(href, file); }
    catch (error) { failures.push(`${file}: invalid link ${href}: ${error.message}`); continue; }
    if (!target) continue;
    linksChecked++;
    const withinRepo = target === root || target.startsWith(root + sep);
    check(withinRepo, `${file}: local link escapes repository: ${href}`);
    if (withinRepo) check(await exists(target), `${file}: missing link target: ${href}`);
    targets.push(target);
  }
  return { text, targets };
}

const catalog = await readJson('course/catalog.json');
const index = await readJson('evidence/desktop-lab/index.json');
if (catalog && index) {
  const lessons = Array.isArray(catalog.lessons) ? catalog.lessons : [];
  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const experiments = Array.isArray(index.experiments) ? index.experiments : [];
  check(lessons.length === 16, `Expected 16 topic chapters; found ${lessons.length}.`);
  check(JSON.stringify(lessons.map(lesson => lesson.id).filter(id => id !== '10-hooks')) === JSON.stringify(preservedLessonIds), 'The original 15 chapter ids and their relative order must remain stable.');
  const hooksPosition = lessons.findIndex(lesson => lesson.id === '10-hooks');
  check(hooksPosition > 0 && lessons[hooksPosition - 1]?.id === '09-mcp' && lessons[hooksPosition + 1]?.id === '10-permissions', 'Hooks must follow MCP and precede permissions in catalog display order.');
  check(groups.length === 4, `Expected 4 groups; found ${groups.length}.`);
  experimentCount = experiments.length;
  stageCount = experiments.reduce((count, item) => count + (item.stages || []).length, 0);
  for (const [id, stageIds] of Object.entries(preservedStages)) {
    const experiment = experiments.find(item => item.id === id);
    check(Boolean(experiment), `Missing preserved experiment: ${id}`);
    for (const stageId of stageIds) check(experiment?.stages?.some(stage => stage.id === stageId), `Missing preserved evidence stage: ${id}/${stageId}`);
  }
  check(new Set(lessons.map(item => item.id)).size === lessons.length, 'Lesson ids must be unique.');
  check(new Set(lessons.map(item => item.file)).size === lessons.length, 'Lesson files must be unique.');
  check(new Set(groups.map(item => item.id)).size === groups.length, 'Group ids must be unique.');
  check(new Set(experiments.map(item => item.id)).size === experiments.length, 'Experiment ids must be unique.');
  for (const group of groups) check(lessons.some(lesson => lesson.group === group.id), `Empty course group: ${group.id}`);
  const experimentIds = new Set(experiments.map(item => item.id));
  const screenshotIndex = await readJson('docs/images/desktop-lab/index.json');
  if (screenshotIndex) {
    check(screenshotIndex.schemaVersion === 1 && Array.isArray(screenshotIndex.images), 'Screenshot index must use schemaVersion 1 and an images array.');
    const images = Array.isArray(screenshotIndex.images) ? screenshotIndex.images : [];
    screenshotCount = images.length;
    check(new Set(images.map(image => image.id)).size === images.length, 'Screenshot ids must be unique.');
    check(new Set(images.map(image => image.file)).size === images.length, 'Screenshot file paths must be unique.');
    const coveredChapters = new Set();
    const imageRoot = resolve('docs/images/desktop-lab');
    for (const image of images) {
      check(typeof image.id === 'string' && image.id.length > 0, 'Screenshot id must be a nonempty string.');
      check(typeof image.caption === 'string' && image.caption.length > 0, `${image.id}: missing screenshot caption.`);
      check(Array.isArray(image.chapters) && image.chapters.length > 0, `${image.id}: missing chapter mapping.`);
      for (const chapter of image.chapters || []) {
        check(lessons.some(lesson => lesson.id === chapter), `${image.id}: unknown chapter ${chapter}`);
        coveredChapters.add(chapter);
      }
      check(Array.isArray(image.experiments) && image.experiments.length > 0, `${image.id}: missing experiment mapping.`);
      for (const link of image.experiments || []) {
        const experiment = experiments.find(item => item.id === link.id);
        check(Boolean(experiment), `${image.id}: unknown experiment ${link.id}`);
        if (!experiment) continue;
        check(link.threadId === experiment.threadId && link.manifestFile === experiment.manifestFile
          && JSON.stringify(link.turnIds) === JSON.stringify(experiment.turnIds), `${image.id}: experiment identifiers differ from ${link.id}`);
      }
      const { source, crop } = image;
      const dimensions = [image.width, image.height, source?.width, source?.height, crop?.width, crop?.height];
      check(dimensions.every(value => Number.isInteger(value) && value > 0), `${image.id}: invalid screenshot dimensions.`);
      check(Number.isInteger(crop?.x) && crop.x >= 0 && Number.isInteger(crop?.y) && crop.y >= 0
        && crop.x + crop.width <= source?.width && crop.y + crop.height <= source?.height
        && crop.width === image.width && crop.height === image.height, `${image.id}: crop must fit within its recorded source dimensions.`);
      check(/^[a-f0-9]{64}$/.test(source?.sha256 || ''), `${image.id}: invalid private-source hash.`);
      const target = typeof image.file === 'string' ? resolve(image.file) : '';
      const safe = target.startsWith(imageRoot + sep) && image.file.endsWith('.png');
      check(safe, `${image.id}: screenshot path must stay within docs/images/desktop-lab.`);
      if (!safe) continue;
      try {
        const realTarget = await realpath(target);
        if (!realTarget.startsWith(imageRoot + sep)) {
          check(false, `${image.id}: screenshot symlink leaves its public directory.`);
          continue;
        }
        const png = await readFile(target);
        const validHeader = png.length >= 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && png.toString('ascii', 12, 16) === 'IHDR';
        check(validHeader, `${image.id}: public file is not a PNG with an IHDR header.`);
        if (validHeader) check(png.readUInt32BE(16) === image.width && png.readUInt32BE(20) === image.height, `${image.id}: PNG dimensions differ from the index.`);
        check(createHash('sha256').update(png).digest('hex') === image.sha256, `${image.id}: public PNG hash differs from the index.`);
      } catch (error) { failures.push(`${image.id}: cannot verify public screenshot: ${error.message}`); }
    }
    screenshotChapterCount = coveredChapters.size;
    for (const id of ['hook-marker-repeat', 'hook-pre-tool', 'hook-post-tool']) {
      check(images.find(image => image.id === id)?.chapters.includes('10-hooks'), `${id}: required Hooks screenshot is not mapped to the Hooks chapter.`);
    }
  }
  const legacyRoutes = Object.entries(catalog.legacyRoutes || {});
  check(legacyRoutes.length === 20, 'All 20 previous chapter URLs need an explicit destination.');
  for (const [previous, current] of Object.entries(preservedLegacyRoutes)) check(catalog.legacyRoutes?.[previous] === current, `Preserved legacy URL ${previous} must still resolve to ${current}`);
  for (const [previous, current] of legacyRoutes) {
    check(!lessons.some(lesson => lesson.id === previous), `Legacy URL conflicts with a current chapter: ${previous}`);
    check(lessons.some(lesson => lesson.id === current), `Legacy URL ${previous} has no current destination: ${current}`);
  }
  const chapterTargets = new Map();
  for (let position = 0; position < lessons.length; position++) {
    const lesson = lessons[position];
    check(typeof lesson.id === 'string' && /^[a-z\d-]+$/.test(lesson.id), `Invalid stable lesson id: ${lesson.id}`);
    if (preservedLessonIds.includes(lesson.id)) check(lesson.file === `course/${lesson.id}.md`, `${lesson.id}: existing chapter file must remain stable.`);
    check(typeof lesson.title === 'string' && lesson.title.trim(), `Missing lesson title: ${lesson.id}`);
    check(groups.some(group => group.id === lesson.group), `Unknown group for ${lesson.id}: ${lesson.group}`);
    check(['verified', 'partial'].includes(lesson.status), `Invalid status for ${lesson.id}: ${lesson.status}`);
    check(typeof lesson.file === 'string' && /^course\/[^/]+\.md$/.test(lesson.file), `Invalid public lesson path for ${lesson.id}: ${lesson.file}`);
    if (typeof lesson.file !== 'string') continue;
    const { text, targets } = await documentLinks(lesson.file);
    chapterTargets.set(lesson.id, new Set(targets));
    check(text.startsWith('# '), `${lesson.file}: missing Markdown title.`);
    if (position > 0) check(targets.includes(resolve(lessons[position - 1].file)), `${lesson.file}: missing link to previous chapter.`);
    if (position < lessons.length - 1) check(targets.includes(resolve(lessons[position + 1].file)), `${lesson.file}: missing link to next chapter.`);
    check(Array.isArray(lesson.evidenceIds) && lesson.evidenceIds.length > 0, `${lesson.id}: evidenceIds must reference at least one experiment.`);
    for (const id of lesson.evidenceIds || []) check(experimentIds.has(id), `${lesson.id}: unknown evidence id ${id}`);
    if (lesson.status === 'partial') check(/未验证|未实测|尚未|没有.{0,30}(?:实测|证据)/.test(text), `${lesson.file}: partial status requires an explicit unverified boundary.`);
    if (lesson.id === '08-memory') {
      const audit = await readJson('evidence/desktop-lab/native-memory-recall-consolidated/audit.json');
      check(lesson.status === 'verified' && audit?.outcome === 'native_memory_recalled', '08-memory requires the recorded native-memory recall result.');
      check(audit?.generation?.stage1?.status === 'done'
        && audit?.generation?.consolidation?.status === 'done'
        && audit?.generation?.consolidation?.sourceSelectedForPhase2 === true, 'Native recall must trace to completed extraction and consolidation of its source.');
      const on = experiments.find(item => item.id === 'native-memory-recall-consolidated');
      const off = experiments.find(item => item.id === 'native-memory-recall-consolidated-off');
      const source = experiments.find(item => item.id === 'native-memory-source');
      check(audit?.generation?.sourceThreadId === source?.threadId
        && audit?.recall?.on?.threadId === on?.threadId && audit?.recall?.off?.threadId === off?.threadId,
      'Native memory audit must reference the actual source and recall chats.');
      check(on && off && on.threadId !== off.threadId && on.threadId !== source?.threadId
        && off.threadId !== source?.threadId && on.prompt === off.prompt, 'Recall controls must use independent chats and identical prompts.');
      check(on && !on.prompt.includes('松果回执') && /不知道/.test(off?.reply || ''), 'Recall prompts must not supply the answer; the memory-off control must record its unknown answer.');
      if (on && off) {
        const onRequest = await readJson(on.stages[0].requestFile);
        const offRequest = await readJson(off.stages[0].requestFile);
        const memory = onRequest?.input?.[2]?.content?.[1]?.text || '';
        const summary = audit?.generation?.artifacts?.find(item => item.path === 'memory_summary.md');
        const targetLine = summary?.excerpt?.find(item => item.text.includes('实付金额 → 原价合计 → 减免金额'))?.text;
        check(Boolean(targetLine) && memory.includes(targetLine), 'Recall input must contain the exact target line from the generated memory summary.');
        check(!JSON.stringify(offRequest?.input || []).includes('松果回执'), 'The memory-off input must not contain the target answer.');
        check(!onRequest?.previous_response_id && !offRequest?.previous_response_id
          && [onRequest, offRequest].every(request => !(request?.input || []).some(item => item.role === 'assistant')),
        'Recall controls must not inherit earlier responses or replay assistant history.');
        check(on.stats.toolCalls === 0 && off.stats.toolCalls === 0, 'This recorded recall case must preserve its zero-tool observation.');
        check(Date.parse(audit?.generation?.consolidation?.finishedAt) < Date.parse(on.stages[0].requestTimestamp), 'Consolidation must precede the successful recall request.');
      }
      check(text.includes('自动注入') && text.includes('未测试'), 'Memory chapter must retain the boundary between automatic injection and untested retrieval paths.');
    }
  }
  for (const image of screenshotIndex?.images || []) {
    // The index records the historical chapter mapping. Moving an explanation
    // must preserve the image and a current reading entry, not its old location.
    check([...chapterTargets.values()].some(targets => targets.has(resolve(image.file))), `${image.id}: historical screenshot has no current course reference.`);
  }
  const runtimeLabLinks = {
    '10-hooks': ['README.md', 'start/.codex/hooks.example.json', 'start/.codex/hooks/prompt-marker.mjs',
      'start/.codex/hooks/tool-experiment.mjs', 'start/.codex/hook-lab/protected.txt',
      'start/.codex/hook-lab/allowed.txt', 'start/.codex/hook-lab/pass.test.mjs',
      'start/.codex/hook-lab/fail.test.mjs', 'results/.codex/hook-lab/allowed.txt'],
    '13-autonomy': ['start/lab/background-delay.mjs', 'start/src/price.ts',
      'start/lab/plan-state/price.ts', 'start/lab/plan-state/price.test.mjs', 'results/lab/plan-state/price.ts',
      'start/lab/patch-recovery/price.ts', 'start/lab/patch-recovery/price.test.mjs', 'results/lab/patch-recovery/price.ts'],
  };
  for (const [chapter, paths] of Object.entries(runtimeLabLinks)) {
    for (const path of paths) {
      const file = `examples/runtime-lab/${path}`;
      check((await exists(file))?.isFile(), `Missing runtime example file: ${file}`);
      check(chapterTargets.get(chapter)?.has(resolve(file)), `${chapter}: missing direct link to ${file}`);
    }
  }
  for (const file of ['README.md', 'SOURCE.md', 'start/README.md']) await documentLinks(`examples/runtime-lab/${file}`);
  await readJson('examples/runtime-lab/start/.codex/hooks.example.json');
  await readJson('examples/runtime-lab/start/package.json');
  check(lessons.some(lesson => lesson.id === '08-memory'), 'The memory chapter and its evidence boundary must be present.');
  for (const file of ['README.md', 'PROGRESS.md', 'GLOSSARY.md', 'CHANGELOG.md', 'course/introduction.md', 'THIRD_PARTY_NOTICES.md', 'site/docs/DESIGN.md', 'docs/images/desktop-lab/README.md']) await documentLinks(file);
  const sectionIds = await readJson('course/section-ids.json');
  const baseline = await readJson('docs/section-baseline.json');
  check(Boolean(baseline?.commit) && Array.isArray(baseline?.sections), 'Section compatibility needs its recorded commit and heading baseline.');
  for (const item of baseline?.sections || []) {
    const target = catalog.sectionRedirects?.[`${item.lesson}:${item.section}`] || { lesson: item.lesson, section: item.section };
    check(Object.values(sectionIds?.[target.lesson] || {}).includes(target.section), `${item.lesson}/${item.section}: no stable section or explicit migration destination.`);
  }
  for (const [source, target] of Object.entries(catalog.sectionRedirects || {})) {
    check(Boolean(sectionIds?.[target.lesson]) && Object.values(sectionIds[target.lesson]).includes(target.section), `${source}: section redirect has no registered destination.`);
  }
  for (const file of await readdir('lessons/02-desktop-lab-chronological')) if (file.endsWith('.md')) await documentLinks(`lessons/02-desktop-lab-chronological/${file}`);
  const coveredExperiments = new Set(lessons.flatMap(lesson => lesson.evidenceIds || []));
  for (const experiment of experiments) check(coveredExperiments.has(experiment.id), `Experiment missing from the reader: ${experiment.id}`);

  // Only these schema fields are public file references. Source metadata may
  // deliberately point to redacted or private original logs and is not a link.
  for (const experiment of experiments) {
    const referenced = [experiment.manifestFile, experiment.compactionFile, experiment.interruptionFile,
      experiment.auditFile, experiment.rolloutEventsFile, experiment.hookEventsFile, experiment.fileObservationsFile];
    for (const stage of experiment.stages || []) referenced.push(stage.requestFile, stage.responseFile, stage.eventsFile, stage.upstreamFile, stage.outputItemsFile);
    for (const path of referenced.filter(Boolean)) {
      check(path.startsWith('evidence/desktop-lab/'), `${experiment.id}: evidence file is outside the new public evidence tree: ${path}`);
      check(await exists(path), `${experiment.id}: missing evidence file ${path}`);
    }
    if (experiment.status === 'interrupted') check(Boolean(experiment.interruptionFile), `${experiment.id}: interrupted experiment needs interruptionFile.`);
    if (experiment.id.startsWith('native-memory-')) {
      const privacy = await readJson(`evidence/desktop-lab/${experiment.id}/privacy.json`);
      for (const file of privacy?.files || []) {
        check(file.file.startsWith(`evidence/desktop-lab/${experiment.id}/`), `${experiment.id}: privacy file reference must stay within the experiment.`);
        if (await exists(file.file)) check(createHash('sha256').update(await readFile(file.file)).digest('hex') === file.publicFileSha256, `${file.file}: public evidence differs from its privacy record.`);
        else check(false, `${file.file}: privacy record points to a missing file.`);
      }
    }
  }
}

for (const file of await jsonFiles('evidence/desktop-lab')) {
  if (relative(root, file).replaceAll('\\', '/') !== 'evidence/desktop-lab/index.json') await readJson(file);
}

const commonExampleFiles = ['README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'src/index.ts', 'src/price.ts', 'tests/price.test.ts'];
for (const name of ['01-baseline', '07-fixed', '13-mcp', '14-discount']) {
  const required = [...commonExampleFiles];
  if (name !== '01-baseline') required.push('AGENTS.md', '.agents/skills/price-project-check/SKILL.md');
  if (name === '13-mcp' || name === '14-discount') required.push('mcp/catalog.ts', 'mcp/check-catalog.ts', 'docs/DECISIONS.md');
  if (name === '13-mcp') required.push('.codex/config.example.toml');
  for (const file of required) check((await exists(`examples/${name}/${file}`))?.isFile(), `Missing example file: examples/${name}/${file}`);
}

for (const [name, passes] of [['01-baseline', 0], ['07-fixed', 1], ['14-discount', 11]]) {
  const result = spawnSync(process.execPath, ['--test', 'tests/price.test.ts'], { cwd: `examples/${name}`, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  const output = (result.stdout || '') + (result.stderr || '');
  if (result.error) failures.push(`${name}: could not run snapshot test: ${result.error.message}`);
  if (name === '01-baseline') {
    check(result.status === 1 && /13\s*!==\s*30/.test(output), `${name}: expected the intentional 13 !== 30 assertion failure; got exit ${result.status}.\n${output}`);
  } else {
    check(result.status === 0 && new RegExp(`(?:#|ℹ) pass ${passes}(?:\\r?\\n|$)`).test(output), `${name}: expected ${passes} passing tests; got exit ${result.status}.\n${output}`);
  }
}

if (failures.length) {
  console.error(`Course checks failed (${failures.length}):\n` + failures.map(message => '- ' + message).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Course checks passed: 16 chapters / 4 groups; original 15 chapter ids and 20 legacy routes preserved; ${experimentCount} experiments / ${stageCount} stages including all original 26 / 74; ${screenshotCount} screenshots mapped to ${screenshotChapterCount} chapters; ${linksChecked} local links; ${jsonChecked} JSON files; 4 complete example snapshots. Runtime checks: intentional baseline failure, 1 fixed test, 11 discount tests. Native memory injection chain and public evidence hashes checked.`);
}
