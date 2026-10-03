import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';

const files = import.meta.glob(['../course/**/*.md', '../course/**/*.json', '../evidence/desktop-lab/**/*.json', '../evidence/desktop-lab/**/*.jsonl', '../evidence/desktop-lab/**/*.md', '../evidence/desktop-lab/**/*.txt'], { query: '?raw', import: 'default' });
const images = import.meta.glob('../docs/images/**/*.{png,jpg,jpeg,webp,svg}', { query: '?url', import: 'default', eager: true });
const repo = 'https://github.com/chrichuang218/agent-harness-notes';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const json = value => JSON.stringify(value, null, 2);
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fileCache = new Map();
const jsonCache = new Map();
const states = new Map();
const textCopies = new Map();
let textNumber = 0;
let catalog;
let experiments;
let activeLesson = '';
let responseLocations;
let fileLocations;
let relations;
let toastTimer;
let routeNumber = 0;
let searchNumber = 0;
let evidenceObserver;
const pageLoads = new Map();
const outlines = new Map();

function loadFile(path) {
  if (!files['../' + path]) return Promise.reject(new Error('未找到公开文件：' + path));
  if (!fileCache.has(path)) fileCache.set(path, files['../' + path]());
  return fileCache.get(path);
}
async function loadJson(path) {
  if (!jsonCache.has(path)) jsonCache.set(path, loadFile(path).then(JSON.parse));
  return jsonCache.get(path);
}
function href(id, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null)).toString();
  return (id === 'introduction' ? '#/guide' : '#/lesson/' + encodeURIComponent(id)) + (query ? '?' + query : '');
}
function evidenceHref(lessonId, experimentId, stage, view = 'request', extra = {}) {
  return href(lessonId, { experiment: experimentId, stage, view, ...extra });
}
const lessonNumber = lesson => String(catalog.lessons.indexOf(lesson) + 1).padStart(2, '0');
const stageLabel = (stage, experiment) => `${stage.prewarm ? '预热' : experiment.requestKind === 'compaction' ? '压缩请求' : '正式请求'} · ${stage.id}`;
function preferredLesson(experimentId, preferred = activeLesson) {
  return catalog.lessons.find(lesson => lesson.id === preferred && lesson.evidenceIds.includes(experimentId)) || catalog.lessons.find(lesson => lesson.evidenceIds.includes(experimentId));
}
function copyButton(text, label = '复制全文') {
  const id = ++textNumber;
  textCopies.set(id, String(text));
  return `<button type="button" data-copy="${id}">${label}</button>`;
}
function releaseCopies(container) {
  container.querySelectorAll('[data-copy]').forEach(button => textCopies.delete(Number(button.dataset.copy)));
}
function codePanel(text, title = '完整内容', attrs = '') {
  // A code child prevents HTML's initial-pre-newline removal; character
  // references preserve CR characters that the HTML parser would normalize.
  return `<div class="code-panel"><div class="code-toolbar"><span>${esc(title)}</span>${copyButton(text)}</div><pre tabindex="0" ${attrs}><code>${esc(text).replace(/\r/g, '&#13;')}</code></pre></div>`;
}
function rawDetails(value, label = '展开完整 JSON（保留原字段）', open = false) {
  return `<details class="raw-details" ${open ? 'open' : ''}><summary>${esc(label)}</summary>${codePanel(json(value), '完整 JSON')}</details>`;
}
function metadata(value) {
  return `<dl class="metadata">${Object.entries(value).map(([key, text]) => `<div><dt>${esc(key)}</dt><dd>${esc(typeof text === 'object' ? json(text) : text)}</dd></div>`).join('')}</dl>`;
}
function contentBlocks(content, prefix, open = false) {
  if (!Array.isArray(content)) return codePanel(typeof content === 'string' ? content : json(content), prefix + ' · 完整字段');
  return content.map((block, index) => {
    const path = `${prefix}[${index}]`;
    const text = typeof block.text === 'string' ? block.text : null;
    const body = text === null ? json(block) : text;
    const preview = body.replace(/\s+/g, ' ').slice(0, 90);
    return `<details class="content-block" data-content-path="${esc(path)}" ${open ? 'open' : ''}><summary><code>${esc(path)}</code> <span>${esc(block.type || '无 type 字段')}</span><small>${text === null ? '完整对象' : `${text.length.toLocaleString()} 字符`}</small></summary><p class="content-preview">预览：${esc(preview)}${body.length > 90 ? '…（展开下方完整文本）' : ''}</p>${codePanel(body, text === null ? '完整内容块 JSON' : '完整 text 原文 · 可滚动', `data-full-content="${esc(path)}"`)}${text === null ? '' : rawDetails(block, '查看该内容块的所有字段')}</details>`;
  }).join('');
}
function toolsMarkup(tools, path) {
  if (!Array.isArray(tools)) return codePanel(json(tools), path + ' · 完整工具定义');
  return `<p class="field-note">${esc(path)} 含 ${tools.length} 个顶层定义，namespace 中的工具保留在对应定义中。</p>${tools.map((tool, index) => `<details class="tool-definition"><summary><code>${esc(path)}[${index}]</code> ${esc(tool.name || tool.type)} <small>${esc(tool.type)}${Array.isArray(tool.tools) ? ` · ${tool.tools.length} 个内层工具` : ''}</small></summary>${codePanel(json(tool), '完整工具定义 · 含描述和参数', `data-tool-path="${esc(path)}[${index}]"`)}</details>`).join('')}`;
}
function itemMarkup(item, prefix, index, output = false) {
  const path = `${prefix}[${index}]`;
  const shortMessage = item.type === 'message' && Array.isArray(item.content) && item.content.every(block => (block.text || '').length < 300);
  const isResult = /tool_call_output|function_call_output/.test(item.type || '');
  const isCall = /tool_call$|function_call$/.test(item.type || '');
  let body = '';
  if (has(item, 'content')) body += contentBlocks(item.content, path + '.content', output || shortMessage);
  if (has(item, 'tools')) body += toolsMarkup(item.tools, path + '.tools');
  for (const key of ['input', 'arguments', 'output']) if (has(item, key)) {
    body += codePanel(typeof item[key] === 'string' ? item[key] : json(item[key]), `${path}.${key} · 完整字段`, `data-value-path="${path}.${key}"`);
  }
  const visibleMetadata = Object.fromEntries(['name', 'namespace', 'call_id', 'id', 'status', 'phase'].filter(key => has(item, key)).map(key => [key, item[key]]));
  if (Object.keys(visibleMetadata).length) body = metadata(visibleMetadata) + body;
  if (!body) body = codePanel(json(item), path + ' · 完整项目');
  return `<details class="trace-item" data-item-path="${path}" ${output || shortMessage || isResult ? 'open' : ''}><summary><code>${path}</code><span class="role-badge">${esc(item.role || '无 role 字段')}</span><strong>${esc(item.type || '未标注 type')}</strong><span class="item-description">${isResult ? '工具返回结果' : isCall ? '模型提出的调用' : item.type === 'additional_tools' ? '可用工具定义' : Array.isArray(item.content) ? item.content.length + ' 个内容块' : ''}</span></summary><div class="trace-item-body">${body}${rawDetails(item, '查看这个项目的完整原始 JSON')}</div></details>`;
}
function requestMarkup(request) {
  const input = request.input;
  const toolPaths = (Array.isArray(input) ? input : []).flatMap((item, index) => has(item, 'tools') ? [`input[${index}].tools`] : []);
  if (has(request, 'tools')) toolPaths.unshift('tools');
  const top = Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'input'));
  return `<div class="request-intro"><p>按原数组顺序显示输入；<code>role</code>、内容块和工具结果均保留。展开每项可读完整正文，复制得到完整字段，不截断源文本。</p><p>工具定义位置：${toolPaths.length ? toolPaths.map(path => `<code>${path}</code>`).join('、') : '本次请求未包含工具定义'}。顶层 <code>instructions</code>：${has(request, 'instructions') ? '存在（下方可展开）' : '不存在'}。</p></div>${has(request, 'instructions') ? codePanel(typeof request.instructions === 'string' ? request.instructions : json(request.instructions), '顶层 instructions · 完整内容') : ''}${has(request, 'tools') ? toolsMarkup(request.tools, 'tools') : ''}<div class="input-actions"><strong>input · ${Array.isArray(input) ? input.length : '非数组'} 项</strong><button data-expand-inputs>展开全部输入与内容块</button><button data-collapse-inputs>收起长文本</button></div>${Array.isArray(input) ? input.map((item, index) => itemMarkup(item, 'input', index)).join('') : codePanel(json(input), '完整 input 字段')}${rawDetails(top, '查看所有请求级字段（input 已在上方逐项展示）')}`;
}
function outputMarkup(derived, completed) {
  const items = derived?.items || completed?.response?.output || [];
  return `<p class="evidence-notice">${derived ? '以下输出项由 response.output_item.done 事件按顺序提取，是衍生视图；原 response.completed 未被改写。' : '以下为完成事件中记录的 output。'}</p>${items.length ? items.map((item, index) => itemMarkup(item, 'output', index, true)).join('') : '<p class="empty-state">本阶段没有记录到输出项。请结合预热标记、完成事件及流式事件判断。</p>'}${rawDetails(completed, '展开原始 response.completed 完成事件')}`;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function responseLink(id, preferred, label = id) {
  if (!id) return '<span class="muted">无（未携带该字段）</span>';
  const location = responseLocations.get(id)?.[0];
  const lesson = location && preferredLesson(location.experiment.id, preferred);
  return lesson ? `<a href="${esc(evidenceHref(lesson.id, location.experiment.id, location.index, 'output'))}">${esc(label)}</a>` : `<code>${esc(label)}</code><small> · 此响应未收录</small>`;
}

function workbenchShell(lesson) {
  return `<section class="workbench" id="workbench-${lesson.id}" data-workbench="${lesson.id}" aria-busy="false"><h3>内嵌证据工作台</h3><p class="workbench-intro">先读结构，再展开全文。这里可以选择本章关联的全部实验与请求，包括预热。</p><div class="workbench-selectors"><label>实验 <select class="experiment-select" aria-label="选择实验">${lesson.evidenceIds.map(id => { const experiment = experiments.find(item => item.id === id); return `<option value="${esc(id)}">${esc(experiment?.title || id)}</option>`; }).join('')}</select></label><label>请求 <select class="stage-select" aria-label="选择请求"></select></label></div><div class="experiment-summary"></div><div class="request-controls"><button data-stage-prev>← 上一次请求</button><button data-stage-next>下一次请求 →</button><button data-share>复制此位置链接</button></div><div class="request-metadata"></div><div class="workbench-tabs" aria-label="工作台视图"><button data-view="request">输入与工具定义</button><button data-view="output">模型输出</button><button data-view="calls">工具调用与结果</button><button data-view="compare">客户端 / 上游</button><button data-view="raw">原始记录</button></div><div class="workbench-content"><button class="load-evidence">加载本次请求的真实证据</button></div></section><section class="supplement" id="supplement-${lesson.id}" hidden aria-label="补充原始证据"></section>`;
}
function homeMarkup() {
  return `<section class="home-page" id="home-view"><header class="home-hero"><h1>从一次修复，<br class="hero-break">看懂 <span>Agent</span></h1><p>在 TypeScript 小项目里使用 Codex Desktop，沿 CPA 日志理解它怎样完成任务。</p><div class="hero-actions"><a class="primary-button" data-start-learning href="${href(catalog.lessons[0].id)}">开始学习 <span aria-hidden="true">→</span></a><a class="secondary-button" href="#/guide">阅读导读</a></div><div class="hero-meta">${catalog.lessons.length} 个主题 <span>·</span> ${experiments.length} 组实验</div></header><section class="home-example" aria-label="贯穿教程的修复案例"><div><span class="eyebrow">从这个错误开始</span><h2>10 × 3，为什么得到 13？</h2><p>读文件、定位错误、修改运算符，再运行测试。一次用户要求，对应五次模型请求。</p><a href="${href('03-agent-loop', { section: 'agent-loop-timeline' })}">跟踪这次修复 <span aria-hidden="true">→</span></a></div><div class="bug-example"><div><span>修复前</span><code>return unitPrice + quantity;</code><strong>13</strong></div><div><span>修复后</span><code>return unitPrice * quantity;</code><strong>30 <small>测试通过</small></strong></div></div></section><section class="learning-path" aria-labelledby="path-title"><div class="path-header"><span class="eyebrow">学习路线</span><h2 id="path-title">从一次请求，到完整运行</h2><p>先读懂输入和工具往返，再追查上下文、扩展能力与完成条件。</p></div>${catalog.groups.map((group, index) => `<section class="phase-section" data-phase="${group.id}"><header class="phase-header"><span class="phase-number">0${index + 1}</span><div><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p></div></header><div class="lesson-grid">${catalog.lessons.filter(lesson => lesson.group === group.id).map(lesson => `<a class="lesson-card" href="${href(lesson.id)}" data-card-lesson="${lesson.id}"><div class="card-top"><span>${lessonNumber(lesson)}</span><span aria-hidden="true">↗</span></div><h4>${esc(lesson.title)}</h4><p>${esc(lesson.subtitle)}</p>${lesson.status === 'partial' ? '<small class="card-status">含待验证内容</small>' : ''}</a>`).join('')}</div></section>`).join('')}</section></section>`;
}
function shell() {
  document.querySelector('#app').innerHTML = `<a class="skip-link" href="#main">跳至正文</a><header class="site-header"><a class="brand" href="#/" aria-label="回到教程首页"><span class="brand-icon"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M10 9h7a6 6 0 0 1 6 6v8M9 9v14h14" stroke="currentColor" stroke-width="2"/><rect x="5" y="5" width="8" height="8" rx="2" fill="var(--paper)" stroke="currentColor" stroke-width="2"/><rect x="19" y="19" width="8" height="8" rx="2" fill="var(--paper)" stroke="currentColor" stroke-width="2"/></svg></span><span>Agent Harness <span class="brand-light">学习笔记</span></span></a><div class="header-actions"><a class="guide-link" href="#/guide">导读</a><a href="${repo}" target="_blank" rel="noopener">GitHub ↗</a><button class="search-toggle" aria-label="搜索课程">⌕ <span>搜索</span></button><button id="theme-toggle" aria-label="切换深浅主题">◐ <span>主题</span></button><button class="menu-toggle" aria-label="展开学习目录" aria-expanded="false">☰</button></div></header><div class="mobile-shade" hidden></div><aside class="course-sidebar"><div class="directory-search"><span>⌕</span><input id="chapter-search" type="search" aria-label="搜索文档" placeholder="搜索课程…"></div><nav id="chapter-nav" aria-label="教程目录">${navMarkup()}</nav></aside><main id="main" tabindex="-1" aria-busy="true">${homeMarkup()}<section class="reader-page" id="reader-view" hidden><nav class="breadcrumb" aria-label="当前位置"></nav><div class="reading-layout"><div class="reading-content"><div id="lesson-content"></div><nav class="chapter-pagination" aria-label="章节翻页"></nav></div></div></section></main><footer class="site-footer"><div><a href="#/">Agent Harness 学习笔记</a></div></footer><button id="back-top" aria-label="回到顶部">↑</button><div class="toast" role="status" aria-live="polite"></div>`;
  document.querySelector('#theme-toggle').onclick = () => {
    document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('ah-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); } catch { /* Theme remains usable without storage. */ }
  };
  document.querySelector('.menu-toggle').onclick = () => toggleMenu(!document.body.classList.contains('menu-open'));
  document.querySelector('.search-toggle').onclick = () => { toggleMenu(true); document.querySelector('#chapter-search').focus(); };
  document.querySelector('.mobile-shade').onclick = () => toggleMenu(false);
  document.querySelector('.skip-link').onclick = event => { event.preventDefault(); document.querySelector('#main').focus(); document.querySelector('#main').scrollIntoView(); };
  document.querySelector('#back-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector('#chapter-search').oninput = () => filterNavigation().catch(error => { console.error(error); showToast('搜索暂时不可用'); });
  document.addEventListener('click', handleClick);
  document.addEventListener('change', event => {
    const host = event.target.closest('[data-workbench]');
    if (!host) return;
    const state = states.get(host.dataset.workbench);
    if (event.target.matches('.experiment-select')) { state.experimentId = event.target.value; state.stage = 0; state.view = 'request'; updateWorkbenchChrome(state); renderWorkbench(state); }
    if (event.target.matches('.stage-select')) { state.stage = Number(event.target.value); updateWorkbenchChrome(state); renderWorkbench(state); }
    if (event.target.matches('.raw-select')) { state.rawKind = event.target.value; renderWorkbench(state); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') toggleMenu(false);
    if ((event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) || ((event.ctrlKey || event.metaKey) && event.key === 'k')) { event.preventDefault(); toggleMenu(true); document.querySelector('#chapter-search').focus(); }
  });
  evidenceObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting || entry.target.closest('[hidden]')) return;
    const state = states.get(entry.target.dataset.workbench);
    if (!state.loaded) renderWorkbench(state, false);
  }), { rootMargin: '-64px 0px 150px 0px' });
}
function toggleMenu(open) {
  document.body.classList.toggle('menu-open', open);
  document.querySelector('.mobile-shade').hidden = !open;
  document.querySelector('.menu-toggle').setAttribute('aria-expanded', String(open));
}
function navMarkup() {
  return `<a class="chapter-link home-link" href="#/">学习路线</a><div class="nav-chapter" data-nav-lesson="introduction"><a class="chapter-link intro-link" href="#/guide">导读与实验准备</a></div>${catalog.groups.map((group, index) => `<div class="nav-group"><h2><span class="nav-dot" aria-hidden="true"></span>0${index + 1} ${esc(group.title)}</h2>${catalog.lessons.filter(lesson => lesson.group === group.id).map(lesson => `<div class="nav-chapter" data-nav-lesson="${lesson.id}"><a class="chapter-link" href="${href(lesson.id)}"><span>${lessonNumber(lesson)}</span>${esc(lesson.title)}</a></div>`).join('')}</div>`).join('')}`;
}
function resolveDocumentPath(path, base) { return new URL(path, 'https://local.invalid/' + base).pathname.slice(1); }
function decorateMarkdown(container, lesson) {
  const headings = [];
  const sectionHeadings = [...container.querySelectorAll('h2,h3,h4,h5,h6,details > summary')].filter(heading => heading.tagName !== 'SUMMARY' || heading.textContent.trim().startsWith('深入'));
  sectionHeadings.forEach((heading, index) => {
    const id = `${lesson.id}-section-${index}`;
    heading.id = id;
    if (heading.tagName === 'SUMMARY') heading.style.scrollMarginTop = '88px';
    headings.push({ id, text: heading.textContent, nested: /^H[3-6]$/.test(heading.tagName) });
    const anchor = document.createElement('a'); anchor.className = 'heading-anchor'; anchor.href = href(lesson.id, { section: id }); anchor.textContent = '#'; anchor.setAttribute('aria-label', '链接到这一段'); heading.append(anchor);
  });
  container.querySelectorAll('img').forEach(image => {
    const path = resolveDocumentPath(image.getAttribute('src'), lesson.file);
    if (images['../' + path]) {
      image.src = images['../' + path];
      // Preserve author-supplied image links and adjacent captions. A separate
      // original-image label also works when the screenshot has no caption.
      const link = image.parentElement.tagName === 'A' ? image.parentElement : document.createElement('a');
      if (!link.contains(image)) { image.replaceWith(link); link.append(image); }
      link.href = image.src; link.target = '_blank'; link.rel = 'noopener'; link.classList.add('image-original');
      const caption = document.createElement('span'); caption.className = 'image-caption'; caption.textContent = '查看原图'; link.append(caption);
    }
    image.loading = 'lazy';
  });
  container.querySelectorAll('a').forEach(link => {
    const original = link.getAttribute('href') || '';
    if (/^https?:/.test(original)) { link.target = '_blank'; link.rel = 'noopener'; return; }
    if (link.classList.contains('heading-anchor')) return;
    if (original.startsWith('#')) {
      const target = decodeURIComponent(original.slice(1));
      const heading = headings.find(item => item.text === target || item.text.replace(/\s+/g, '-').toLowerCase() === target);
      if (heading) link.href = href(lesson.id, { section: heading.id });
      return;
    }
    const path = resolveDocumentPath(original.split('#')[0], lesson.file);
    const nextLesson = catalog.lessons.find(item => item.file === path);
    if (nextLesson) link.href = href(nextLesson.id);
    else if (path === 'README.md') link.href = '#/';
    else if (path === 'course/introduction.md') link.href = '#/guide';
    else if (files['../' + path]) {
      link.classList.add('source-link'); link.dataset.sourcePath = path;
      const location = fileLocations.get(path);
      const owner = location && preferredLesson(location.experiment.id, lesson.id)?.id;
      const view = location && ({ requestFile: 'request', outputItemsFile: 'output', upstreamFile: 'compare' }[location.kind] || 'raw');
      link.href = location ? evidenceHref(owner, location.experiment.id, location.index, view, view === 'raw' ? { kind: location.kind } : {}) : href(lesson.id, { file: path });
    } else if (images['../' + path]) link.href = images['../' + path];
    else if (path && !original.startsWith('mailto:')) link.href = repo + '/blob/main/' + path;
  });
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('code.language-mermaid')) return;
    const wrapper = document.createElement('div'); wrapper.className = 'code-panel';
    pre.replaceWith(wrapper);
    const toolbar = document.createElement('div'); toolbar.className = 'code-toolbar';
    toolbar.innerHTML = `<span>${esc(pre.querySelector('code')?.className.match(/language-(\S+)/)?.[1] || 'TEXT')}</span>${copyButton(pre.textContent)}`;
    wrapper.append(toolbar, pre);
  });
  container.querySelectorAll('table').forEach(table => { const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0; table.replaceWith(wrapper); wrapper.append(table); });
  outlines.set(lesson.id, headings);
}
async function ensurePage(lesson) {
  if (pageLoads.has(lesson.id)) return pageLoads.get(lesson.id);
  const pending = (async () => {
    const text = await loadFile(lesson.file);
    const page = document.createElement('section');
    page.hidden = true; page.dataset.readerPage = lesson.id;
    if (lesson.id === 'introduction') {
      page.id = 'guide-page';
      page.innerHTML = `<article class="prose introduction" id="introduction">${DOMPurify.sanitize(marked.parse(text))}</article><section class="supplement" id="supplement-introduction" hidden aria-label="导读补充原始证据"></section>`;
    } else {
      page.id = 'chapter-' + lesson.id; page.className = 'chapter'; page.dataset.lesson = lesson.id;
      const markdown = text.replace(/^# [^\n]+\n/, '');
      page.innerHTML = `<header class="chapter-header"><div class="chapter-kicker"><span class="chapter-number">${lessonNumber(lesson)}</span><span>${esc(catalog.groups.find(group => group.id === lesson.group).title)}</span></div><h1>${esc(lesson.title)}</h1><p class="chapter-subtitle">${esc(lesson.subtitle || '')}</p><div class="chapter-meta">${lesson.status === 'partial' ? '<span>部分行为尚未验证，具体范围见正文。</span>' : ''}<a href="${repo}/blob/main/${lesson.file}" target="_blank" rel="noopener">Markdown 原文 ↗</a></div></header><article class="prose">${DOMPurify.sanitize(marked.parse(markdown))}</article>${workbenchShell(lesson)}`;
      // The Markdown navigation still works on GitHub; the site has a dedicated
      // previous/next control below the workbench.
      const last = page.querySelector('.prose > p:last-child');
      if (last && /上一章|下一章/.test(last.textContent)) last.remove();
    }
    document.querySelector('#lesson-content').append(page);
    decorateMarkdown(page.querySelector('.prose'), lesson);
    if (lesson.id !== 'introduction') {
      const experiment = experiments.find(item => item.id === lesson.evidenceIds[0]);
      const state = { lessonId: lesson.id, experimentId: experiment.id, stage: Math.max(0, experiment.stages.findIndex(stage => !stage.prewarm)), view: 'request', rawKind: 'requestFile', loaded: false, version: 0 };
      states.set(lesson.id, state); updateWorkbenchChrome(state);
      evidenceObserver.observe(page.querySelector('[data-workbench]'));
    }
    if (lesson.id === '03-agent-loop') {
      const timeline = document.createElement('section'); timeline.id = 'agent-loop-timeline'; timeline.className = 'agent-loop-timeline';
      page.querySelector('.prose h2,.prose h3').before(timeline);
      outlines.get(lesson.id).unshift({ id: timeline.id, text: '真实请求时间线' });
      const { mountAgentLoopTimeline } = await import('./agent-loop-timeline.js');
      await mountAgentLoopTimeline(timeline, { loadJson, evidenceHref, experiment: experiments.find(item => item.id === '07-fix'), copyButton });
    }
    return page;
  })();
  pageLoads.set(lesson.id, pending);
  return pending;
}
async function renderDiagrams(page) {
  const codes = page.querySelectorAll('code.language-mermaid');
  if (!codes.length) return;
  const { default: mermaid } = await import('mermaid');
  codes.forEach(code => { const div = document.createElement('div'); div.className = 'mermaid'; div.textContent = code.textContent; code.parentElement.replaceWith(div); });
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Arial, Microsoft YaHei, sans-serif' });
  await mermaid.run({ nodes: page.querySelectorAll('.mermaid') });
  page.querySelectorAll('.mermaid').forEach(diagram => {
    const svg = diagram.querySelector('svg');
    if (!svg) return;
    const width = svg.viewBox.baseVal.width;
    if (width > 0) { svg.style.width = Math.ceil(width) + 'px'; svg.style.maxWidth = 'none'; svg.style.height = 'auto'; }
    const hint = document.createElement('p'); hint.className = 'diagram-hint'; hint.textContent = '图表保持原始字号，可在框内横向滚动。';
    diagram.before(hint); diagram.tabIndex = 0; diagram.setAttribute('role', 'region'); diagram.setAttribute('aria-label', '架构图，可横向滚动查看');
  });
}
function showPage(page, lesson) {
  const previousLesson = activeLesson;
  document.body.dataset.view = page ? 'reader' : 'home';
  document.querySelector('#home-view').hidden = Boolean(page);
  document.querySelector('#reader-view').hidden = !page;
  document.querySelectorAll('[data-reader-page]').forEach(node => node.hidden = node !== page);
  setActive(lesson?.id || '');
  document.querySelector('.chapter-outline')?.remove();
  if (!page) return;
  const group = catalog.groups.find(item => item.id === lesson.group);
  document.querySelector('.breadcrumb').innerHTML = `<a href="#/">学习路线</a><span aria-hidden="true">/</span>${group ? `<span>${esc(group.title)}</span><span aria-hidden="true">/</span>` : ''}<span aria-current="page">${lesson.id === 'introduction' ? '导读' : esc(lesson.title)}</span>`;
  const headings = outlines.get(lesson.id) || [];
  const outline = document.createElement('nav'); outline.className = 'chapter-outline'; outline.setAttribute('aria-label', '本章目录');
  outline.innerHTML = headings.map(heading => `<a href="${href(lesson.id, { section: heading.id })}" data-section="${heading.id}"${heading.nested ? ' class="nested"' : ''}>${esc(heading.text)}</a>`).join('') + (lesson.id === 'introduction' ? '' : `<a href="${href(lesson.id, { section: 'workbench-' + lesson.id })}" data-section="workbench-${lesson.id}">证据工作台</a>`);
  document.querySelector(`[data-nav-lesson="${lesson.id}"]`).append(outline);
  if (previousLesson !== lesson.id) {
    const sidebar = document.querySelector('.course-sidebar');
    const chapterLink = outline.previousElementSibling;
    const top = chapterLink.getBoundingClientRect().top;
    const visibleTop = sidebar.getBoundingClientRect().top + document.querySelector('.directory-search').offsetHeight;
    if (top < visibleTop || top > innerHeight - 120) sidebar.scrollTop += top - visibleTop - 12;
  }
  const index = catalog.lessons.indexOf(lesson);
  const previous = index > 0 ? catalog.lessons[index - 1] : null;
  const next = lesson.id === 'introduction' ? catalog.lessons[0] : catalog.lessons[index + 1];
  document.querySelector('.chapter-pagination').innerHTML = `${previous ? `<a data-direction="previous" href="${href(previous.id)}"><small>← 上一章</small><strong>${lessonNumber(previous)} ${esc(previous.title)}</strong></a>` : '<a data-direction="previous" href="#/guide"><small>← 阅读准备</small><strong>导读与实验准备</strong></a>'}${next ? `<a data-direction="next" href="${href(next.id)}"><small>下一章 →</small><strong>${lessonNumber(next)} ${esc(next.title)}</strong></a>` : '<a data-direction="next" href="#/"><small>回到学习路线 →</small><strong>复习各个主题</strong></a>'}`;
  if (lesson.id === 'introduction') document.querySelector('.chapter-pagination [data-direction="previous"]').outerHTML = '<a data-direction="previous" href="#/"><small>← 回到首页</small><strong>学习路线</strong></a>';
}
function updateWorkbenchChrome(state) {
  const host = document.querySelector(`[data-workbench="${state.lessonId}"]`);
  const experiment = experiments.find(item => item.id === state.experimentId);
  const select = host.querySelector('.experiment-select');
  if (![...select.options].some(option => option.value === experiment.id)) select.add(new Option(experiment.title + '（关联记录）', experiment.id));
  select.value = experiment.id;
  host.querySelector('.stage-select').innerHTML = experiment.stages.map((stage, index) => `<option value="${index}" ${index === state.stage ? 'selected' : ''}>${stageLabel(stage, experiment)}</option>`).join('');
  const interrupted = experiment.status === 'interrupted';
  const inputNote = experiment.id === '17-goal' ? '通过原生 Goal 入口设置目标，具体目标见请求中的 goal 包装及本章记录。'
    : ['16-agent-a', '16-agent-b'].includes(experiment.id) ? '由父任务委派，普通聊天输入为空。实际委派内容见请求中的 agent_message 及本章说明。'
    : '本记录没有普通聊天输入，触发方式见本章说明与原始记录。';
  const inputMarkup = experiment.prompt?.trim() ? `<div><span>你</span><p>${esc(experiment.prompt)}</p></div>` : `<p class="delegation-note">${inputNote}</p>`;
  const submissionMethod = experiment.submission?.method;
  const submissionLabel = { 'computer-use-desktop-composer': '输入框提交。', 'codex-app-create-thread': '跨任务工具提交；不能作为普通输入框的 Hook 信任对照。' }[submissionMethod];
  const reply = interrupted && !experiment.reply ? '本轮已中断，没有最终回复。单次模型完成事件不代表整个任务成功完成。' : experiment.reply || '本记录没有普通最终回复，请查看逐阶段模型输出和本章原生事件。';
  host.querySelector('.experiment-summary').innerHTML = `<p class="experiment-count">${experiment.stats.requests} 次正式模型请求${experiment.stats.prewarms ? ` + ${experiment.stats.prewarms} 次预热` : ''} · ${experiment.stats.toolCalls} 次外层工具调用${interrupted ? '<strong class="interrupted-badge">已中断</strong>' : ''}</p>${experiment.requestKind === 'compaction' ? '<p class="evidence-notice">原生压缩操作，没有普通聊天输入与最终回复。原始记录中可查看本地压缩事件。</p>' : `<details class="conversation" open><summary>这次实验的输入与${interrupted ? '中断状态' : '回复'}</summary>${inputMarkup}<div><span>${interrupted || !experiment.reply ? '状态' : 'Codex'}</span><p>${esc(reply)}</p></div></details>`}`;
  if (submissionLabel) host.querySelector('.experiment-count').insertAdjacentHTML('afterend', `<p class="field-note" data-submission-method="${esc(submissionMethod)}">${esc(submissionLabel)}</p>`);
  if (experiment.coverage === 'text-progress-only') host.querySelector('.experiment-summary').insertAdjacentHTML('beforeend', '<p class="evidence-notice">本轮没有原生计划状态工具；记录中的清单属于文字进度。</p>');
  host.querySelector('[data-stage-prev]').disabled = state.stage === 0;
  host.querySelector('[data-stage-next]').disabled = state.stage === experiment.stages.length - 1;
  host.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === state.view); button.setAttribute('aria-pressed', String(button.dataset.view === state.view)); });
  host.dataset.experiment = experiment.id; host.dataset.stage = state.stage; host.dataset.view = state.view;
}
async function renderWorkbench(state, updateUrl = true) {
  const version = ++state.version;
  state.loaded = true;
  const host = document.querySelector(`[data-workbench="${state.lessonId}"]`);
  const experiment = experiments.find(item => item.id === state.experimentId);
  const stage = experiment.stages[state.stage];
  const content = host.querySelector('.workbench-content');
  updateWorkbenchChrome(state);
  host.setAttribute('aria-busy', 'true');
  releaseCopies(content);
  content.innerHTML = '<p class="loading-state">正在加载本次证据…</p>';
  if (updateUrl) history.replaceState(null, '', evidenceHref(state.lessonId, experiment.id, state.stage, state.view, state.view === 'raw' ? { kind: state.rawKind } : {}));
  try {
    const [request, completed, derived] = await Promise.all([loadJson(stage.requestFile), loadJson(stage.responseFile), stage.outputItemsFile ? loadJson(stage.outputItemsFile) : null]);
    if (version !== state.version) return;
    const response = completed.response || completed;
    const next = experiments.flatMap(item => item.stages.map((nextStage, index) => ({ experiment: item, stage: nextStage, index }))).filter(item => item.stage.previousResponseId === stage.responseId);
    host.querySelector('.request-metadata').innerHTML = `<dl><div><dt>请求时间</dt><dd>${esc(stage.requestTimestamp)}</dd></div><div><dt>model / generate</dt><dd><code>${esc(request.model)}</code> / ${has(request, 'generate') ? esc(request.generate) : '未显式设置'}</dd></div><div><dt>previous_response_id</dt><dd>${responseLink(request.previous_response_id, state.lessonId)}</dd></div><div><dt>本次 response.id</dt><dd><code>${esc(response.id || stage.responseId)}</code></dd></div><div><dt>后续响应引用</dt><dd>${next.length ? next.map(item => responseLink(item.stage.responseId, state.lessonId, item.experiment.id + ' / ' + item.stage.id)).join(' · ') : '收录记录中未发现直接引用；不据此断言没有后续上下文。'}</dd></div></dl>`;
    if (state.view === 'request') content.innerHTML = requestMarkup(request);
    else if (state.view === 'output') content.innerHTML = outputMarkup(derived, completed);
    else if (state.view === 'calls') {
      const markup = await callsMarkup(state, request, derived?.items || []);
      if (version !== state.version) { for (const match of markup.matchAll(/data-copy="(\d+)"/g)) textCopies.delete(Number(match[1])); return; }
      content.innerHTML = markup;
    }
    else if (state.view === 'compare') {
      const [upstream, clientText, upstreamText] = await Promise.all([loadJson(stage.upstreamFile), loadFile(stage.requestFile), loadFile(stage.upstreamFile)]);
      if (version !== state.version) return;
      content.innerHTML = `<p class="comparison-result">${canonical(request) === canonical(upstream) ? '本次客户端与上游快照的 JSON 字段和值一致。' : '本次客户端与上游快照存在差异，请按字段逐项核对。'}不把其他请求的转发行为套用到这里。</p><div class="compare-grid">${codePanel(clientText, '客户端 → CPA · 完整快照', 'data-client-raw')}${codePanel(upstreamText, 'CPA → 上游 · 完整快照', 'data-upstream-raw')}</div>`;
    } else {
      const available = [['requestFile', '客户端请求', stage.requestFile], ['outputItemsFile', '输出项（衍生）', stage.outputItemsFile], ['responseFile', '完成事件', stage.responseFile], ['eventsFile', '流式事件', stage.eventsFile], ['upstreamFile', '上游请求', stage.upstreamFile], ['compactionFile', '压缩记录', experiment.compactionFile], ['interruptionFile', '中断记录', experiment.interruptionFile], ['hookEventsFile', 'Hook 事件', experiment.hookEventsFile], ['rolloutEventsFile', '本地执行事件', experiment.rolloutEventsFile], ['fileObservationsFile', '文件变化与退出码', experiment.fileObservationsFile], ['auditFile', '证据核对', experiment.auditFile], ['manifestFile', '实验来源与脱敏', experiment.manifestFile]].filter(([, , path]) => path);
      const selected = available.find(([kind]) => kind === state.rawKind) || available[0];
      state.rawKind = selected[0];
      const text = await loadFile(selected[2]);
      if (version !== state.version) return;
      content.innerHTML = `<div class="raw-controls"><label>原始文件 <select class="raw-select" aria-label="选择原始记录">${available.map(([kind, label]) => `<option value="${kind}" ${kind === state.rawKind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button data-download="${esc(selected[2])}">下载文件 ↓</button></div><p class="source-path">${esc(selected[2])}</p><p class="field-note">${state.rawKind === 'outputItemsFile' ? '这是从流式事件提取的衍生输出项；原完成事件保留原样。' : state.rawKind === 'responseFile' && experiment.status === 'interrupted' ? '本轮用户任务已中断。这里的 response.completed 只证明对应模型响应结束。' : '公开快照已脱敏，完整内容如下；处理方式见实验来源说明。'}</p>${codePanel(text, selected[1] + ' · 文件全文', 'data-raw-content')}`;
    }
    if (version === state.version) { host.setAttribute('aria-busy', 'false'); host.dataset.ready = 'true'; }
  } catch (error) {
    if (version !== state.version) return;
    console.error('证据加载失败', error);
    content.innerHTML = `<p class="error-state">${esc(error.message)}</p>`; host.setAttribute('aria-busy', 'false'); host.dataset.ready = 'error';
  }
}

async function buildRelations() {
  if (!relations) relations = Promise.all(experiments.flatMap(experiment => experiment.stages.map(async (stage, index) => {
    const [request, output] = await Promise.all([loadJson(stage.requestFile), stage.outputItemsFile ? loadJson(stage.outputItemsFile) : null]);
    return { experiment, stage, index, request, output: output?.items || [] };
  }))).then(rows => {
    const registry = new Map();
    for (const row of rows) {
      for (const [kind, items] of [['calls', row.output], ['results', row.request.input || []]]) items.forEach((item, itemIndex) => {
        if (!item.call_id || (kind === 'results' && !/call_output$/.test(item.type || '')) || (kind === 'calls' && !/call$/.test(item.type || ''))) return;
        if (!registry.has(item.call_id)) registry.set(item.call_id, { calls: [], results: [] });
        registry.get(item.call_id)[kind].push({ ...row, item, itemIndex });
      });
    }
    return registry;
  });
  return relations;
}
async function callsMarkup(state, request, output) {
  const registry = await buildRelations();
  const calls = output.filter(item => item.call_id && /call$/.test(item.type || ''));
  const inputs = (request.input || []).filter(item => item.call_id && /call_output$/.test(item.type || ''));
  const ids = [...new Set([...calls, ...inputs].map(item => item.call_id))];
  return `<p class="evidence-notice">按真实 <code>call_id</code> 配对。调用来自模型输出，结果来自后续请求；重复发送的同一结果仍分别保留。外层工具中的脚本内容不被虚构成独立调用。</p>${ids.length ? ids.map(id => {
    const matches = registry.get(id) || { calls: [], results: [] };
    return `<section class="call-pair"><h4><code>${esc(id)}</code></h4><h5>模型提出的调用</h5>${matches.calls.length ? matches.calls.map(item => relatedItem(item, state, 'output')).join('') : '<p>输出项中未找到调用来源。</p>'}<h5>交回模型的结果</h5>${matches.results.length ? matches.results.map(item => relatedItem(item, state, 'request')).join('') : '<p>记录中未找到对应结果，尚不能确认执行成功。</p>'}</section>`;
  }).join('') : '<p class="empty-state">这个阶段没有提出新的工具调用，也没有输入工具结果。可选择前后请求继续观察。</p>'}`;
}
function relatedItem(item, state, view) {
  const lesson = preferredLesson(item.experiment.id, state.lessonId);
  return `<details class="related-item" open><summary>${esc(item.experiment.id)} / ${esc(item.stage.id)} · ${esc(item.item.name || item.item.type)}</summary><a class="related-source" href="${evidenceHref(lesson.id, item.experiment.id, item.index, view, { input: view === 'request' ? item.itemIndex : undefined })}">跳到对应${view === 'request' ? '请求输入' : '模型输出'} →</a>${codePanel(json(item.item), view === 'request' ? '完整工具结果项目' : '完整调用项目', `data-call-item="${esc(item.item.call_id)}"`)}</details>`;
}
async function openSupplement(lessonId, path) {
  const expectedRoute = routeNumber;
  const host = document.querySelector('#supplement-' + lessonId);
  if (!host) throw new Error('该位置没有补充证据区域。');
  host.hidden = false; host.setAttribute('aria-busy', 'true'); host.dataset.sourcePath = path; host.dataset.sourceRoute = String(expectedRoute);
  const text = await loadFile(path);
  if (host.dataset.sourcePath !== path || host.dataset.sourceRoute !== String(expectedRoute)) return;
  if (expectedRoute !== routeNumber) { host.hidden = true; host.setAttribute('aria-busy', 'false'); return; }
  host.hidden = false;
  releaseCopies(host);
  host.innerHTML = `<div class="supplement-heading"><h3>补充原始证据</h3><button data-close-source>收起</button></div><p class="source-path">${esc(path)}</p><div class="source-actions"><button data-download="${esc(path)}">下载文件 ↓</button>${copyButton(location.href, '复制此位置链接')}</div>${codePanel(text, '公开文件全文 · 保留原结构', 'data-supplement-content')}`;
  host.setAttribute('aria-busy', 'false'); revealSection(host);
}

async function handleClick(event) {
  const anchor = event.target.closest('a');
  if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && anchor?.getAttribute('href') === location.hash && location.hash.startsWith('#/')) {
    event.preventDefault(); await route(); return;
  }
  const copy = event.target.closest('[data-copy]');
  if (copy) { await copyText(textCopies.get(Number(copy.dataset.copy))); return; }
  const download = event.target.closest('[data-download]');
  if (download) {
    const path = download.dataset.download;
    const blob = URL.createObjectURL(new Blob([await loadFile(path)], { type: path.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = blob; link.download = path.split('/').at(-1); link.click(); setTimeout(() => URL.revokeObjectURL(blob), 1000); return;
  }
  if (event.target.closest('[data-close-source]')) { event.target.closest('.supplement').hidden = true; return; }
  if (event.target.closest('.course-sidebar a')) toggleMenu(false);
  const host = event.target.closest('[data-workbench]');
  if (!host) return;
  const state = states.get(host.dataset.workbench);
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) { state.view = button.dataset.view; await renderWorkbench(state); }
  else if (button.hasAttribute('data-stage-prev')) { state.stage--; await renderWorkbench(state); }
  else if (button.hasAttribute('data-stage-next')) { state.stage++; await renderWorkbench(state); }
  else if (button.hasAttribute('data-share')) await copyText(new URL(evidenceHref(state.lessonId, state.experimentId, state.stage, state.view, state.view === 'raw' ? { kind: state.rawKind } : {}), location.href).href);
  else if (button.matches('.load-evidence')) await renderWorkbench(state);
  else if (button.hasAttribute('data-expand-inputs')) host.querySelectorAll('.trace-item,.content-block').forEach(details => details.open = true);
  else if (button.hasAttribute('data-collapse-inputs')) host.querySelectorAll('.trace-item,.content-block').forEach(details => details.open = false);
}
async function copyText(text) {
  const toast = document.querySelector('.toast');
  try { await navigator.clipboard.writeText(String(text)); toast.textContent = '已复制完整内容'; }
  catch { toast.textContent = '复制失败，请选中文字手动复制。'; }
  toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
}
function setActive(id) {
  activeLesson = id;
  document.querySelectorAll('[data-nav-lesson]').forEach(node => {
    const active = node.dataset.navLesson === id;
    node.classList.toggle('active', active);
    if (active) node.querySelector('a').setAttribute('aria-current', 'page'); else node.querySelector('a').removeAttribute('aria-current');
  });
  document.querySelector('.intro-link').classList.toggle('active', id === 'introduction');
}
async function filterNavigation() {
  const version = ++searchNumber;
  const query = document.querySelector('#chapter-search').value.trim().toLowerCase();
  const text = query ? await Promise.all(catalog.lessons.map(lesson => loadFile(lesson.file))) : [];
  if (version !== searchNumber) return;
  catalog.lessons.forEach((lesson, index) => {
    document.querySelector(`[data-nav-lesson="${lesson.id}"]`).hidden = Boolean(query) && !(lesson.title + ' ' + (lesson.subtitle || '') + ' ' + text[index]).toLowerCase().includes(query);
  });
  document.querySelectorAll('.nav-group').forEach(group => group.hidden = ![...group.querySelectorAll('.nav-chapter')].some(chapter => !chapter.hidden));
}
async function route() {
  const currentRoute = ++routeNumber;
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const requestedId = path.startsWith('lesson/') ? decodeURIComponent(path.slice(7)) : ['guide', 'intro', 'introduction'].includes(path) ? 'introduction' : '';
  let id = requestedId === '0' ? 'introduction' : has(catalog.legacyRoutes || {}, requestedId) ? catalog.legacyRoutes[requestedId] : requestedId;
  const sectionRedirect = !params.has('experiment') && !params.has('file') && catalog.sectionRedirects?.[`${id}:${params.get('section')}`];
  if (sectionRedirect) {
    id = sectionRedirect.lesson;
    params.set('section', sectionRedirect.section);
  }
  let lesson = catalog.lessons.find(item => item.id === id);
  const requestedExperiment = params.has('file')
    ? experiments.find(experiment => params.get('file').startsWith(`evidence/desktop-lab/${experiment.id}/`))?.id
    : params.get('experiment');
  if (requestedExperiment) {
    lesson = preferredLesson(requestedExperiment, id) || lesson;
    if (lesson) id = lesson.id;
  }
  if (id !== requestedId || (id === 'introduction' && path !== 'guide')) {
    if (params.get('section') === 'workbench-' + requestedId) params.set('section', 'workbench-' + id);
    else if (id !== requestedId && requestedId !== '0' && params.get('section')?.startsWith(requestedId + '-section-')) params.delete('section');
    history.replaceState(null, '', href(id, Object.fromEntries(params)));
  }
  toggleMenu(false);
  const main = document.querySelector('#main');
  if (!lesson && id !== 'introduction') {
    if (id) showToast('未找到该章节，已返回学习路线。');
    showPage(null); main.setAttribute('aria-busy', 'false');
    document.title = '从一次修复，看懂 Agent · Agent Harness 学习笔记';
    window.scrollTo({ top: 0, behavior: 'instant' }); return;
  }
  if (id === 'introduction') lesson = { id: 'introduction', file: 'course/introduction.md', title: '导读与实验准备' };
  main.setAttribute('aria-busy', 'true');
  const page = await ensurePage(lesson);
  if (currentRoute !== routeNumber) return;
  showPage(page, lesson);
  document.title = lesson.title + ' · Agent Harness 学习笔记';
  await renderDiagrams(page);
  if (currentRoute !== routeNumber) return;
  main.setAttribute('aria-busy', 'false');
  if (params.has('file')) { await openSupplement(id, params.get('file')); return; }
  if (params.has('experiment') && id !== 'introduction') {
    const state = states.get(id);
    const experiment = experiments.find(item => item.id === params.get('experiment'));
    if (!experiment) { showToast('未找到该实验记录。'); return; }
    state.experimentId = experiment.id;
    state.stage = Math.max(0, Math.min(Number(params.get('stage')) || 0, experiment.stages.length - 1));
    state.view = ['request', 'output', 'calls', 'compare', 'raw'].includes(params.get('view')) ? params.get('view') : 'request';
    state.rawKind = params.get('kind') || 'requestFile';
    await renderWorkbench(state, false);
    if (currentRoute !== routeNumber) return;
    const host = document.querySelector(`[data-workbench="${id}"]`);
    if (params.has('input')) {
      const item = host.querySelector(`[data-item-path="input[${Number(params.get('input'))}]"]`);
      if (item) { item.open = true; if (params.has('content')) { const block = item.querySelector(`[data-content-path="input[${Number(params.get('input'))}].content[${Number(params.get('content'))}]"]`); if (block) block.open = true; } revealSection(item); return; }
    }
    revealSection(host); return;
  }
  const section = params.get('section') && document.getElementById(params.get('section'));
  if (section && page.contains(section)) revealSection(section);
  else window.scrollTo({ top: 0, behavior: 'instant' });
}
function revealSection(element) {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  element.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function showToast(text) { const toast = document.querySelector('.toast'); toast.textContent = text; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200); }
function scrollSpy() {
  document.querySelector('#back-top').classList.toggle('visible', scrollY > 400);
  const page = document.querySelector('[data-reader-page]:not([hidden])');
  const headings = page ? [...page.querySelectorAll('.prose h2[id],.prose h3[id],.prose h4[id],.prose h5[id],.prose h6[id],.prose details > summary[id],.agent-loop-timeline,.workbench')] : [];
  const current = headings.filter(node => node.getClientRects().length && node.getBoundingClientRect().top < 170).at(-1);
  document.querySelectorAll('.chapter-outline [data-section]').forEach(link => {
    const active = Boolean(current?.id) && link.dataset.section === current.id;
    link.classList.toggle('current', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
}

async function start() {
  [catalog, { experiments }] = await Promise.all([loadJson('course/catalog.json'), loadJson('evidence/desktop-lab/index.json')]);
  responseLocations = new Map(); fileLocations = new Map();
  for (const experiment of experiments) experiment.stages.forEach((stage, index) => {
    if (!responseLocations.has(stage.responseId)) responseLocations.set(stage.responseId, []);
    responseLocations.get(stage.responseId).push({ experiment, stage, index });
    for (const kind of ['requestFile', 'responseFile', 'eventsFile', 'upstreamFile', 'outputItemsFile']) if (stage[kind]) fileLocations.set(stage[kind], { experiment, index, kind });
  });
  shell();
  addEventListener('hashchange', () => route().catch(error => { console.error(error); showToast(error.message); }));
  await route();
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { scrollSpy(); queued = false; }); } }, { passive: true });
}
start().catch(error => {
  console.error('教程加载失败', error);
  if (!document.querySelector('#main')) document.querySelector('#app').innerHTML = '<main id="main"></main>';
  const main = document.querySelector('#main');
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = `<p class="error-state">教程加载失败：${esc(error.message)}</p>`;
});
