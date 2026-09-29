import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

// Run after npm run build. A private headless browser never touches Desktop.
const root = resolve('dist');
const catalog = JSON.parse(await readFile('course/catalog.json', 'utf8'));
const evidence = JSON.parse(await readFile('evidence/desktop-lab/index.json', 'utf8'));
const captureReadme = process.argv.includes('--capture-readme');
assert.equal(catalog.lessons.length, 20, 'Final site must contain all 20 chapters.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const openLesson = async lesson => {
    assert.ok(lesson, 'Requested lesson is missing from catalog.');
    await page.goto(url + '#/lesson/' + lesson.id);
    await page.waitForFunction(id => {
      const main = document.querySelector('#main');
      return main?.dataset.lessonId === id && main.getAttribute('aria-busy') === 'false';
    }, lesson.id);
    await page.locator('.prose').waitFor();
  };
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'horizontal page overflow');
  await page.goto(url);
  await page.locator('.hero h1').waitFor();
  assert.equal(await page.locator('.lesson-row').count(), catalog.lessons.length);
  assert.ok((await page.locator('.trace-window').innerText()).includes(evidence.experiments[0].reply));
  await noOverflow();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: 'work/site-home-desktop.png', fullPage: true, animations: 'disabled' });
  if (captureReadme) {
    await mkdir('docs/images', { recursive: true });
    await page.screenshot({ path: 'docs/images/site-preview.png', fullPage: false, animations: 'disabled' });
  }

  for (const lesson of catalog.lessons) {
    await openLesson(lesson);
    assert.equal(await page.locator('h1').count(), 1, lesson.id + ' duplicate title');
    assert.equal(await page.locator('.lesson-header h1').innerText(), lesson.title);
    assert.ok((await page.locator('.prose').innerText()).length > 100, lesson.id + ' missing content');
    assert.equal(await page.locator('.experiment').count(), lesson.evidenceIds.length);
    await noOverflow();
  }
  await openLesson(catalog.lessons[0]);
  await page.screenshot({ path: 'work/site-reader-desktop.png', fullPage: true, animations: 'disabled' });
  await page.locator('.experiment summary').first().click();
  await page.locator('[data-experiment]').first().click();
  await page.locator('.evidence-code').filter({ hasText: 'response.create' }).waitFor();
  await page.getByRole('tab', { name: '输出项', exact: true }).click();
  await page.locator('.evidence-file').filter({ hasText: 'output-items.json' }).waitFor();
  await page.locator('#copy-evidence').click();
  await page.locator('.toast.visible').waitFor();
  assert.equal(await page.locator('.toast').innerText(), '已复制');
  await page.getByRole('button', { name: '关闭证据' }).click();
  const sourceLink = page.locator('.prose a.source-link').first();
  if (await sourceLink.count()) {
    await sourceLink.click();
    await page.locator('#evidence-dialog[open]').waitFor();
    await page.getByRole('button', { name: '关闭证据' }).click();
  }
  const compaction = evidence.experiments.find(item => item.requestKind === 'compaction');
  const compactionLesson = compaction && catalog.lessons.find(lesson => lesson.evidenceIds.includes(compaction.id));
  assert.ok(compactionLesson, 'Compaction experiment must appear in the public course.');
  if (compactionLesson) {
    await openLesson(compactionLesson);
    const card = page.locator('.experiment').filter({ has: page.locator(`[data-experiment="${compaction.id}"]`) });
    await card.locator('summary').click();
    assert.ok((await card.innerText()).includes('没有普通聊天输入'));
    await card.locator('[data-experiment]').first().click();
    await page.getByRole('tab', { name: '压缩记录', exact: true }).click();
    await page.locator('.evidence-code').filter({ hasText: 'replacement_history' }).waitFor();
    assert.ok((await page.locator('.evidence-footer').innerText()).includes('rollout'));
    await page.getByRole('button', { name: '关闭证据' }).click();
  }
  const interrupted = evidence.experiments.find(item => item.status === 'interrupted');
  const interruptionLesson = interrupted && catalog.lessons.find(lesson => lesson.evidenceIds.includes(interrupted.id));
  assert.ok(interruptionLesson, 'Interrupted experiment must appear in the public course.');
  await openLesson(interruptionLesson);
  const interruptedCard = page.locator('.experiment').filter({ has: page.locator(`[data-experiment="${interrupted.id}"]`) });
  assert.ok((await interruptedCard.locator('summary').innerText()).includes('已中断'));
  await interruptedCard.locator('summary').click();
  if (!interrupted.reply) assert.equal(await interruptedCard.locator('.experiment-conversation > div:last-child p').innerText(), '本轮已中断，没有最终回复。');
  await interruptedCard.locator('[data-experiment]').first().click();
  await page.getByRole('tab', { name: '中断记录', exact: true }).click();
  await page.locator('.evidence-code').filter({ hasText: 'turn_aborted' }).waitFor();
  assert.deepEqual(JSON.parse(await page.locator('.evidence-code').innerText()), JSON.parse(await readFile(interrupted.interruptionFile, 'utf8')));
  await page.getByRole('tab', { name: '完成事件', exact: true }).click();
  assert.ok((await page.locator('.evidence-footer').innerText()).includes('不代表用户任务完成'));
  await page.getByRole('button', { name: '关闭证据' }).click();

  for (const [lessonId, filename] of [['15-permissions', 'runtime-context.json'], ['16-multi-agent', 'collaboration.json'], ['17-goal', 'goal-state.json']]) {
    await openLesson(catalog.lessons.find(lesson => lesson.id === lessonId));
    await page.locator(`.prose a.source-link[href$="${filename}"]`).first().click();
    await page.locator('#evidence-dialog[open]').waitFor();
    await page.waitForFunction(() => {
      try { JSON.parse(document.querySelector('.evidence-code').textContent); return true; } catch { return false; }
    });
    const expected = JSON.parse(await readFile(`evidence/desktop-lab/${lessonId}/${filename}`, 'utf8'));
    assert.deepEqual(JSON.parse(await page.locator('.evidence-code').innerText()), expected);
    await page.getByRole('button', { name: '关闭证据' }).click();
  }
  await page.getByRole('button', { name: '搜索教程' }).click();
  await page.locator('#search-input').fill('call_id');
  await page.waitForFunction(() => document.querySelectorAll('.search-result').length > 0);
  assert.ok((await page.locator('#search-results').innerText()).includes('README'));
  await page.locator('.search-result').first().click();
  assert.equal(await page.locator('#search-dialog').evaluate(element => element.open), false);
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('dark')), true);
  await page.reload();
  await page.locator('#main[aria-busy="false"]').waitFor();
  await page.locator('.prose').waitFor();
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('dark')), true);
  await page.screenshot({ path: 'work/site-reader-dark.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '切换深浅主题' }).click();

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(url); await page.locator('.hero').waitFor(); await noOverflow();
    if (width === 390) await page.screenshot({ path: 'work/site-home-mobile.png', fullPage: true, animations: 'disabled' });
    for (const lesson of catalog.lessons) {
      await openLesson(lesson); await noOverflow();
    }
    if (width === 390) {
      await page.getByRole('button', { name: '展开学习目录' }).click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.locator('.chapter-link:visible').first().click();
      await page.waitForFunction(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false');
      await page.locator('.prose').waitFor();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      await page.screenshot({ path: 'work/site-reader-mobile.png', fullPage: true, animations: 'disabled' });
    }
  }
  await page.goto(url + '#/lesson/missing-chapter'); await page.locator('.error-state').waitFor();
  assert.deepEqual(errors, []);
  console.log(`Site checks passed: ${catalog.lessons.length} chapters at 3 widths; routes, search, evidence, compaction, interruption, runtime/goal/collaboration sources, copy, theme, mobile navigation, unknown route; no page or console errors. Screenshots: work/site-*.png`);
} finally {
  await browser?.close();
  server.close();
}
