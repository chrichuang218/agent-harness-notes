import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { marked } from 'marked';
import { spawnSync } from 'node:child_process';

// Validate the public course and its explicit references, never arbitrary paths
// inside historical prompts, private source metadata, or archived evidence.
const root = resolve('.');
const failures = [];
let linksChecked = 0;
let jsonChecked = 0;
const check = (condition, message) => { if (!condition) failures.push(message); };
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
  check(lessons.length === 15, `Expected 15 topic chapters; found ${lessons.length}.`);
  check(groups.length === 4, `Expected 4 groups; found ${groups.length}.`);
  check(experiments.length === 26, `Expected all 26 preserved experiments; found ${experiments.length}.`);
  check(experiments.reduce((count, item) => count + (item.stages || []).length, 0) === 74, 'All 74 evidence stages must remain available.');
  check(new Set(lessons.map(item => item.id)).size === lessons.length, 'Lesson ids must be unique.');
  check(new Set(lessons.map(item => item.file)).size === lessons.length, 'Lesson files must be unique.');
  check(new Set(groups.map(item => item.id)).size === groups.length, 'Group ids must be unique.');
  check(new Set(experiments.map(item => item.id)).size === experiments.length, 'Experiment ids must be unique.');
  for (const group of groups) check(lessons.some(lesson => lesson.group === group.id), `Empty course group: ${group.id}`);
  const experimentIds = new Set(experiments.map(item => item.id));
  const legacyRoutes = Object.entries(catalog.legacyRoutes || {});
  check(legacyRoutes.length === 20, 'All 20 previous chapter URLs need an explicit destination.');
  for (const [previous, current] of legacyRoutes) {
    check(!lessons.some(lesson => lesson.id === previous), `Legacy URL conflicts with a current chapter: ${previous}`);
    check(lessons.some(lesson => lesson.id === current), `Legacy URL ${previous} has no current destination: ${current}`);
  }
  for (let position = 0; position < lessons.length; position++) {
    const lesson = lessons[position];
    check(typeof lesson.id === 'string' && lesson.id.startsWith(String(position + 1).padStart(2, '0') + '-'), `Lesson sequence mismatch at ${position + 1}: ${lesson.id}`);
    check(typeof lesson.title === 'string' && lesson.title.trim(), `Missing lesson title: ${lesson.id}`);
    check(groups.some(group => group.id === lesson.group), `Unknown group for ${lesson.id}: ${lesson.group}`);
    check(['verified', 'partial'].includes(lesson.status), `Invalid status for ${lesson.id}: ${lesson.status}`);
    check(typeof lesson.file === 'string' && /^course\/[^/]+\.md$/.test(lesson.file), `Invalid public lesson path for ${lesson.id}: ${lesson.file}`);
    if (typeof lesson.file !== 'string') continue;
    const { text, targets } = await documentLinks(lesson.file);
    check(text.startsWith('# '), `${lesson.file}: missing Markdown title.`);
    if (position > 0) check(targets.includes(resolve(lessons[position - 1].file)), `${lesson.file}: missing link to previous chapter.`);
    if (position < lessons.length - 1) check(targets.includes(resolve(lessons[position + 1].file)), `${lesson.file}: missing link to next chapter.`);
    check(Array.isArray(lesson.evidenceIds) && lesson.evidenceIds.length > 0, `${lesson.id}: evidenceIds must reference at least one experiment.`);
    for (const id of lesson.evidenceIds || []) check(experimentIds.has(id), `${lesson.id}: unknown evidence id ${id}`);
    if (lesson.status === 'partial') check(/未验证|未实测|尚未|没有.{0,30}(?:实测|证据)/.test(text), `${lesson.file}: partial status requires an explicit unverified boundary.`);
    if (lesson.id === '08-memory') {
      check(lesson.status === 'partial', '08-memory must remain partial until native generation and recall are actually tested.');
      check(text.includes('生成') && text.includes('召回') && /(?:生成|召回)[^\n]{0,60}(?:未实测|没有|未验证)/.test(text), '08-memory must explain that native memory generation/recall is not yet verified.');
    }
  }
  check(lessons.some(lesson => lesson.id === '08-memory'), 'The memory chapter and its evidence boundary must be present.');
  for (const file of ['README.md', 'PROGRESS.md', 'GLOSSARY.md', 'CHANGELOG.md', 'course/introduction.md']) await documentLinks(file);
  for (const file of await readdir('lessons/02-desktop-lab-chronological')) if (file.endsWith('.md')) await documentLinks(`lessons/02-desktop-lab-chronological/${file}`);
  const coveredExperiments = new Set(lessons.flatMap(lesson => lesson.evidenceIds || []));
  for (const experiment of experiments) check(coveredExperiments.has(experiment.id), `Experiment missing from the reader: ${experiment.id}`);

  // Only these schema fields are public file references. Source metadata may
  // deliberately point to redacted or private original logs and is not a link.
  for (const experiment of experiments) {
    const referenced = [experiment.manifestFile, experiment.compactionFile, experiment.interruptionFile];
    for (const stage of experiment.stages || []) referenced.push(stage.requestFile, stage.responseFile, stage.eventsFile, stage.upstreamFile, stage.outputItemsFile);
    for (const path of referenced.filter(Boolean)) {
      check(path.startsWith('evidence/desktop-lab/'), `${experiment.id}: evidence file is outside the new public evidence tree: ${path}`);
      check(await exists(path), `${experiment.id}: missing evidence file ${path}`);
    }
    if (experiment.status === 'interrupted') check(Boolean(experiment.interruptionFile), `${experiment.id}: interrupted experiment needs interruptionFile.`);
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
  console.log(`Course checks passed: 15 chapters / 4 groups; 20 legacy chapter routes; all 26 experiments / 74 stages; ${linksChecked} local links; ${jsonChecked} JSON files; 4 complete example snapshots. Runtime checks: intentional baseline failure, 1 fixed test, 11 discount tests. Memory remains explicitly partial.`);
}
