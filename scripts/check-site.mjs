import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve('dist');
const catalog = JSON.parse(await readFile('course/catalog.json', 'utf8'));
const { experiments } = JSON.parse(await readFile('evidence/desktop-lab/index.json', 'utf8'));
const captureReadme = process.argv.includes('--capture-readme');
const stages = experiments.flatMap(experiment => experiment.stages.map((stage, index) => ({ experiment, stage, index })));
assert.equal(catalog.lessons.length, 15);
assert.equal(catalog.groups.length, 4);
assert.equal(experiments.length, 26);
assert.equal(stages.length, 74);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '/') && !file.startsWith(root + '\\')) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
  const owner = experiment => catalog.lessons.find(lesson => lesson.evidenceIds.includes(experiment.id));
  const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ': horizontal page overflow');
  async function openWorkbench(experiment, stage, view, extra = {}) {
    const lesson = owner(experiment);
    assert.ok(lesson, 'Experiment is not reachable: ' + experiment.id);
    const query = new URLSearchParams({ experiment: experiment.id, stage: String(stage), view, ...extra });
    await page.goto(url + '#/lesson/' + lesson.id + '?' + query);
    await page.waitForFunction(({ id, experimentId, index, viewName }) => {
      const host = document.querySelector(`[data-workbench="${id}"]`);
      return host?.dataset.experiment === experimentId && host.dataset.stage === String(index) && host.dataset.view === viewName && host.getAttribute('aria-busy') === 'false' && host.dataset.ready === 'true';
    }, { id: lesson.id, experimentId: experiment.id, index: stage, viewName: view });
    return page.locator(`[data-workbench="${lesson.id}"]`);
  }
  async function verifyItems(host, expected, prefix, label) {
    const rendered = await host.locator('.workbench-content').evaluate((container, prefix) => [...container.querySelectorAll(`.trace-item[data-item-path^="${prefix}["]`)].map(item => ({
      path: item.dataset.itemPath,
      role: item.querySelector(':scope > summary .role-badge').textContent,
      original: JSON.parse(item.querySelector(':scope > .trace-item-body > .raw-details > .code-panel > pre').textContent),
      blocks: [...item.querySelectorAll('[data-full-content]')].map(block => ({ path: block.dataset.fullContent, text: block.textContent })),
    })), prefix);
    assert.equal(rendered.length, expected.length, label + ': omitted/reordered items');
    for (let index = 0; index < expected.length; index++) {
      const actual = rendered[index]; const source = expected[index];
      assert.equal(actual.path, `${prefix}[${index}]`, label + ': item position');
      assert.equal(actual.role, source.role || '无 role 字段', label + ': role');
      assert.ok(JSON.stringify(actual.original) === JSON.stringify(source), `${label}: complete ${prefix}[${index}] fields changed`);
      if (Array.isArray(source.content)) {
        assert.equal(actual.blocks.length, source.content.length, `${label}: content block omitted`);
        source.content.forEach((block, blockIndex) => {
          const value = actual.blocks[blockIndex];
          assert.equal(value.path, `${prefix}[${index}].content[${blockIndex}]`);
          assert.ok(value.text === (typeof block.text === 'string' ? block.text : JSON.stringify(block, null, 2)), `${label}: ${prefix}[${index}].content[${blockIndex}] truncated or changed`);
        });
      }
    }
  }
  await page.goto(url);
  await page.locator('#main[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('#main > .error-state').count(), 0, await page.locator('#main').innerText());
  assert.equal(await page.locator('.introduction h1').innerText(), 'Codex 的一次完整运行');
  assert.ok((await page.locator('.introduction h1').boundingBox()).y >= (await page.locator('.site-header').boundingBox()).height, 'Fixed header must not cover the opening title.');
  assert.equal(await page.locator('.chapter').count(), 15);
  assert.equal(await page.locator('.course-stage').count(), 4);
  assert.equal(await page.locator('dialog,.hero').count(), 0, 'Reading/evidence must not depend on dialogs or a marketing hero.');
  assert.ok(await page.locator('.mermaid svg').count(), 'Course diagram did not render.');
  assert.ok(await page.locator('.mermaid svg').first().evaluate(svg => svg.getBoundingClientRect().width >= svg.viewBox.baseVal.width - 1), 'Diagram text must not be scaled down to fit the article.');
  await noOverflow('Desktop introduction');
  assert.equal(await page.locator('.prose').first().evaluate(element => getComputedStyle(element).fontSize), '15px');
  assert.equal(await page.locator('.prose').first().evaluate(element => getComputedStyle(element).lineHeight), '25.5px');
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/site-reader-desktop.png', fullPage: false, animations: 'disabled' });
  if (captureReadme) { await mkdir('docs/images', { recursive: true }); await page.screenshot({ path: 'docs/images/site-preview.png', fullPage: false, animations: 'disabled' }); }
  const screenshot = page.locator('img[src*="desktop-hello-readme"]').first();
  assert.ok(await screenshot.count(), 'Real Desktop screenshot is missing.');
  const asset = await screenshot.getAttribute('src');
  assert.equal((await context.request.get(new URL(asset, url).href)).status(), 200, 'Vite image asset is missing.');
  assert.equal(await screenshot.locator('..').getAttribute('target'), '_blank');
  assert.equal(await screenshot.locator('..').getAttribute('href'), new URL(asset, url).href);
  assert.ok((await screenshot.locator('..').innerText()).includes('点击查看原图'));

  await page.goto(url + '#/lesson/02-tools');
  await page.reload();
  await page.locator('#main[aria-busy="false"]').waitFor();
  await page.waitForLoadState('networkidle');
  const toolsTop = (await page.locator('#chapter-02-tools').boundingBox()).y;
  assert.ok(toolsTop >= 60 && toolsTop < 200, 'A direct chapter link must stay at the chapter after neighbouring evidence loads.');

  const legacyRoutes = {
    '01-hello': '01-request', '02-context': '04-session', '03-readme': '02-tools',
    '04-agents': '06-agents', '05-skills': '07-skills', '06-tests': '03-agent-loop',
    '07-fix': '03-agent-loop', '08-session': '04-session', '09-context': '05-context',
    '10-compaction': '05-context', '11-cache': '05-context', '12-memory': '08-memory',
    '13-mcp': '09-mcp', '14-plan': '11-plan', '15-permissions': '10-permissions',
    '16-multi-agent': '12-multi-agent', '17-goal': '13-autonomy', '18-streaming': '14-streaming',
    '19-recovery': '13-autonomy', '20-interruption': '13-autonomy',
  };
  assert.deepEqual(catalog.legacyRoutes, legacyRoutes, 'Previous chapter destinations must match the topic reorganization.');
  for (const [previous, current] of Object.entries(legacyRoutes)) {
    await page.goto(url + '#/lesson/' + previous + '?section=' + previous + '-section-0');
    await page.waitForFunction(id => location.hash === '#/lesson/' + id, current);
    assert.ok((await page.title()).startsWith(catalog.lessons.find(lesson => lesson.id === current).title));
    assert.ok((await page.locator('#chapter-' + current).boundingBox()).y < 200, previous + ': old heading must land at its new chapter');
  }
  // The context chapter once linked to experiments now taught elsewhere.
  // Existing bookmarks must retain their source, stage and view after moving.
  await page.goto(url + '#/lesson/09-context?experiment=03-readme&stage=1&view=raw&kind=responseFile');
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-workbench="02-tools"]');
    return host.dataset.experiment === '03-readme' && host.dataset.stage === '1' && host.dataset.view === 'raw' && host.getAttribute('aria-busy') === 'false' && host.dataset.ready === 'true';
  });
  assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('experiment'), '03-readme');
  assert.equal(await page.locator('[data-workbench="02-tools"] .stage-select').inputValue(), '1');
  assert.equal(await page.locator('[data-workbench="02-tools"] .raw-select').inputValue(), 'responseFile');
  assert.ok(await page.locator('[data-workbench="02-tools"] [data-raw-content]').textContent() === await readFile(experiments.find(item => item.id === '03-readme').stages[1].responseFile, 'utf8'));

  const foldedHeadings = await page.locator('.chapter .prose details h2,.chapter .prose details h3,.chapter .prose details h4,.chapter .prose details h5,.chapter .prose details h6,.chapter .prose details > summary[id]').evaluateAll(headings => headings.map(heading => ({ id: heading.id, lesson: heading.closest('.chapter').dataset.lesson })));
  assert.equal(await page.locator('.chapter-outline a').filter({ hasText: /核对答案|参考解释|核对思路/ }).count(), 0, 'Exercise answers should stay out of the chapter outline.');
  assert.ok(foldedHeadings.length, 'In-depth sections should be reachable through actual folded content headings.');
  for (const { id, lesson } of foldedHeadings) {
    await page.evaluate(() => document.querySelectorAll('.prose details').forEach(details => details.open = false));
    await page.goto(url + '#/lesson/' + lesson + '?section=' + id);
    await page.waitForFunction(id => {
      const heading = document.getElementById(id);
      for (let node = heading?.parentElement; node; node = node.parentElement) if (node.tagName === 'DETAILS' && !node.open) return false;
      return Boolean(heading?.getClientRects().length);
    }, id);
  }
  const repeatedTarget = foldedHeadings.at(-1);
  await page.evaluate(() => document.querySelectorAll('.prose details').forEach(details => details.open = false));
  await page.locator(`[data-nav-lesson="${repeatedTarget.lesson}"] [data-section="${repeatedTarget.id}"]`).click();
  assert.ok(await page.locator(`[id="${repeatedTarget.id}"]`).evaluate(element => element.closest('details').open), 'Following the current link again must reopen its folded content.');
  await page.evaluate(() => document.querySelectorAll('.prose details').forEach(details => details.open = false));

  // Every recorded stage, including prewarms, is selectable. Compare all input
  // items, roles, content blocks and original objects against public sources.
  let previousCount = 0;
  for (const { experiment, stage, index } of stages) {
    const label = experiment.id + '/' + stage.id;
    let host = await openWorkbench(experiment, index, 'request');
    assert.equal(await host.locator('.stage-select option').count(), experiment.stages.length, label + ': stage selection incomplete');
    const request = await readJson(stage.requestFile);
    await verifyItems(host, request.input || [], 'input', label);
    const top = await host.locator('.workbench-content > .raw-details pre').textContent();
    assert.ok(JSON.stringify(JSON.parse(top)) === JSON.stringify(Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'input'))), label + ': request-level fields changed');
    if (stage.prewarm) assert.ok((await host.locator('.stage-select option:checked').innerText()).includes('预热'));
    if (request.previous_response_id) {
      const previousHref = await host.locator('.request-metadata dl > div').nth(2).locator('a').getAttribute('href');
      const target = new URLSearchParams(previousHref.split('?')[1]);
      const targetExperiment = experiments.find(item => item.id === target.get('experiment'));
      assert.equal(targetExperiment?.stages[Number(target.get('stage'))]?.responseId, request.previous_response_id, label + ': previous response points to wrong stage');
      previousCount++;
    }
    host = await openWorkbench(experiment, index, 'output');
    const derived = stage.outputItemsFile ? await readJson(stage.outputItemsFile) : { items: [] };
    await verifyItems(host, derived.items || [], 'output', label);
    assert.ok((await host.locator('.workbench-content').innerText()).includes('衍生视图'), label + ': derived output must be labelled');
    const completed = await host.locator('.workbench-content > .raw-details pre').textContent();
    assert.ok(JSON.stringify(JSON.parse(completed)) === JSON.stringify(await readJson(stage.responseFile)), label + ': completed event changed');
    host = await openWorkbench(experiment, index, 'compare');
    assert.ok(await host.locator('[data-client-raw]').textContent() === await readFile(stage.requestFile, 'utf8'), label + ': client comparison is incomplete');
    assert.ok(await host.locator('[data-upstream-raw]').textContent() === await readFile(stage.upstreamFile, 'utf8'), label + ': upstream comparison is incomplete');
    host = await openWorkbench(experiment, index, 'raw', { kind: 'eventsFile' });
    assert.ok(await host.locator('[data-raw-content]').textContent() === await readFile(stage.eventsFile, 'utf8'), label + ': streamed events differ from current public source');
  }
  console.log(`Verified all ${experiments.length} experiments / ${stages.length} stages: complete inputs, roles, content blocks, tools, output objects, completion events, client/upstream snapshots; ${previousCount} response references.`);

  const hello = experiments.find(item => item.id === '01-hello');
  let host = await openWorkbench(hello, 1, 'request');
  const request = await readJson(hello.stages[1].requestFile);
  await host.locator('[data-expand-inputs]').click();
  assert.ok(await host.locator('[data-full-content]').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 13, 'Desktop full-text source font is too small.');
  const block = host.locator('[data-content-path="input[5].content[1]"]');
  await block.locator(':scope > .code-panel [data-copy]').click();
  const copiedText = await page.evaluate(() => navigator.clipboard.readText());
  // Windows clipboard converts LF into CRLF; verify every other character and
  // every line, while the DOM checks above remain byte-for-character exact.
  assert.ok(copiedText.replace(/\r\n/g, '\n') === request.input[5].content[1].text.replace(/\r\n/g, '\n'), 'Copied AGENTS/environment text changed beyond native clipboard line endings.');
  await block.locator('summary').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/site-input-fulltext-desktop.png', fullPage: false, animations: 'disabled' });
  await host.locator('[data-share]').click();
  const share = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(share.includes('experiment=01-hello') && share.includes('stage=1'));
  await page.reload(); await page.locator('#main[aria-busy="false"]').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-workbench="01-request"]').dataset.ready === 'true');
  assert.equal(await page.locator('[data-workbench="01-request"] .stage-select').inputValue(), '1');

  const readme = experiments.find(item => item.id === '03-readme');
  host = await openWorkbench(readme, 0, 'calls');
  assert.ok((await host.locator('.call-pair').innerText()).includes('call_'));
  assert.ok(await host.locator('[data-call-item]').count() >= 2, 'Tool call was not paired with its result.');
  const interrupted = experiments.find(item => item.status === 'interrupted');
  host = await openWorkbench(interrupted, 1, 'calls');
  assert.ok((await host.locator('.experiment-summary').innerText()).includes('已中断'));
  assert.ok((await host.locator('.experiment-summary').innerText()).includes('没有最终回复'));
  assert.ok((await host.locator('.workbench-content').innerText()).includes('20-resume'), 'Interrupted tool result must link across experiments.');
  host = await openWorkbench(interrupted, 1, 'raw', { kind: 'interruptionFile' });
  assert.ok((await host.locator('[data-raw-content]').innerText()).includes('turn_aborted'));
  const compact = experiments.find(item => item.requestKind === 'compaction');
  host = await openWorkbench(compact, 0, 'raw', { kind: 'compactionFile' });
  assert.ok((await host.locator('[data-raw-content]').innerText()).includes('replacement_history'));
  const plan = experiments.find(item => item.id === '14-plan');
  host = await openWorkbench(plan, 0, 'request');
  assert.ok((await host.locator('.conversation').innerText()).includes('没有普通最终回复'));
  const child = experiments.find(item => item.id === '16-agent-a');
  host = await openWorkbench(child, 0, 'request');
  assert.ok((await host.locator('.experiment-summary').innerText()).includes('由父任务委派'));
  const goal = experiments.find(item => item.id === '17-goal');
  host = await openWorkbench(goal, 0, 'request');
  assert.ok((await host.locator('.experiment-summary').innerText()).includes('通过原生 Goal 入口设置目标'));
  assert.ok(!(await host.locator('.experiment-summary').innerText()).includes('由父任务委派'), 'A native Goal input must not be labelled as child-agent delegation.');

  for (const [lessonId, path] of [['introduction', 'evidence/desktop-lab/index.json'], ['10-permissions', 'evidence/desktop-lab/15-permissions/runtime-context.json'], ['12-multi-agent', 'evidence/desktop-lab/16-multi-agent/collaboration.json'], ['13-autonomy', 'evidence/desktop-lab/17-goal/goal-state.json']]) {
    await page.goto(url + '#/lesson/' + lessonId + '?file=' + encodeURIComponent(path));
    const supplement = page.locator('#supplement-' + lessonId);
    await supplement.locator('[data-supplement-content]').waitFor({ state: 'visible' });
    assert.ok(await supplement.locator('[data-supplement-content]').textContent() === await readFile(path, 'utf8'), path + ': supplemental source changed');
  }
  await page.locator('#chapter-search').fill('call_id');
  assert.ok(await page.locator('.nav-chapter:not([hidden])').count() > 0);
  assert.ok(await page.locator('.nav-chapter[hidden]').count() > 0);
  await page.locator('#chapter-search').fill('');
  await page.goto(url + '#/');
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  assert.ok(await page.locator('html').evaluate(element => element.classList.contains('dark')));
  assert.equal(await page.locator('.mermaid').first().evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(250, 250, 250)', 'Neutral diagram must retain a readable light background in dark mode.');
  assert.ok(await page.locator('.mermaid').first().evaluate(element => [...element.querySelectorAll('.nodeLabel p,.edgeLabel p')].every(label => Math.max(...getComputedStyle(label).color.match(/\d+/g).slice(0, 3).map(Number)) < 140)), 'Diagram labels must remain dark on the light canvas after a theme toggle.');
  await page.screenshot({ path: 'work/site-reader-dark.png', fullPage: false });
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const lesson of catalog.lessons) { await page.goto(url + '#/lesson/' + lesson.id); await noOverflow(`${width}px ${lesson.id}`); }
    host = await openWorkbench(hello, 1, 'request'); await noOverflow(`${width}px structured input`);
    assert.ok(await host.locator('[data-full-content]').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 12, 'Mobile full-text source font is too small.');
    if (width === 390) {
      await page.getByRole('button', { name: '展开学习目录' }).click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.locator('.intro-link').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.ok(await page.locator('.mermaid').first().evaluate(element => element.scrollWidth > element.clientWidth), 'Wide mobile diagram must scroll inside its frame.');
      assert.ok(await page.locator('.mermaid svg').first().evaluate(svg => svg.getBoundingClientRect().width >= svg.viewBox.baseVal.width - 1), 'Mobile diagram must retain its intrinsic scale.');
      await page.screenshot({ path: 'work/site-reader-mobile.png', fullPage: false, animations: 'disabled' });
      await openWorkbench(hello, 1, 'request'); await page.screenshot({ path: 'work/site-workbench-mobile.png', fullPage: false, animations: 'disabled' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openWorkbench(hello, 1, 'request'); await page.screenshot({ path: 'work/site-workbench-desktop.png', fullPage: false, animations: 'disabled' });
  assert.deepEqual(errors, [], 'Browser errors must not be swallowed.');
  console.log(`Site checks passed: continuous 15-topic reader; all 20 legacy routes; ${foldedHeadings.length} folded headings; all ${stages.length} stages; full-text copy/share; cross-experiment call/response links; native records; real image asset; 3 widths; no page or console errors.`);
} finally { await browser?.close(); server.close(); }
