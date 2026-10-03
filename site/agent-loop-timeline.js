import './timeline.css';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const originalText = value => escapeHtml(value).replace(/\r/g, '&#13;');
const jsonText = value => JSON.stringify(value, null, 2);
const descriptions = [
  { title: '读取项目', inputSummary: '用户提出修复要求，并接续此前失败测试的响应。', outputSummary: '模型用一次 exec 安排读取技能、文件清单和项目文件。', feedback: '读取结果返回当前规则、实现与测试。Git 状态检查退出码为 1，因为目录未初始化 Git；其他读取仍取得了内容。' },
  { title: '搜索调用位置', inputSummary: '模型收到第一批读取结果，再结合已有要求决定改哪里。', outputSummary: '模型搜索 calculateTotal 的定义、调用位置和项目规则。', feedback: '搜索结果列出计算函数、测试和示例入口，供下一次生成定位修改。' },
  { title: '修改代码与说明', inputSummary: '模型收到搜索结果，已经能核对函数的使用位置。', outputSummary: '模型提出补丁，将加法改为乘法，并更新 README 的状态说明。', feedback: '修改工具只返回 {}，其中没有最终文件正文。后面还需要重读文件和运行验证。' },
  { title: '验证修改', inputSummary: '模型收到修改工具的返回，用户要求的验证尚未执行。', outputSummary: '模型安排类型检查、测试、示例运行，并重读修改后的文件。', feedback: '命令结果和重读的文件一起回传。三个退出码与示例输出列在时间线末尾，可以打开原请求核对。' },
  { title: '汇报结果', inputSummary: '模型收到三项验证结果和修改后的文件内容。', outputSummary: '模型据此汇报修复与验证，本次响应没有新的工具调用。' },
];

// This view intentionally covers one recorded experiment. Stage labels explain
// the evidence; input, output, identities and check results come from its files.
export async function buildAgentLoopData({ experiment, loadJson }) {
  if (experiment?.id !== '07-fix') throw new Error('修复时间线需要 07-fix 实验。');
  const formalStages = experiment.stages.map((stage, index) => ({ stage, index })).filter(({ stage }) => !stage.prewarm);
  if (formalStages.length !== descriptions.length) throw new Error('07-fix 的正式请求数量与时间线不符。');

  const rows = await Promise.all(formalStages.map(async ({ stage, index }, order) => {
    const [request, output, completed] = await Promise.all([loadJson(stage.requestFile), loadJson(stage.outputItemsFile), loadJson(stage.responseFile)]);
    if (!Array.isArray(request.input) || !Array.isArray(output.items) || !completed.response?.id) throw new Error(`${stage.id} 缺少请求或响应证据。`);
    const calls = output.items.filter(item => item.type === 'custom_tool_call');
    if (calls.length !== (order < 4 ? 1 : 0)) throw new Error(`${stage.id} 的工具调用数量与时间线不符。`);
    return { stage, index, order, request, output: output.items, response: completed.response, call: calls[0] || null, ...descriptions[order] };
  }));

  rows.forEach((row, index) => {
    if (!row.call) return;
    const next = rows[index + 1];
    const inputIndex = next.request.input.findIndex(item => item.type === 'custom_tool_call_output' && item.call_id === row.call.call_id);
    if (inputIndex < 0 || next.request.previous_response_id !== row.response.id) throw new Error(`${row.stage.id} 的调用与下一请求没有完整配对。`);
    row.result = { item: next.request.input[inputIndex], inputIndex, stageIndex: next.index, order: next.order };
  });

  const userItem = rows[0].request.input.find(item => item.type === 'message' && item.role === 'user');
  const userText = userItem?.content?.filter(block => typeof block.text === 'string').map(block => block.text).join('\n');
  const finalItem = rows.at(-1).output.find(item => item.type === 'message' && item.phase === 'final_answer');
  const finalText = finalItem?.content?.filter(block => typeof block.text === 'string').map(block => block.text).join('\n');
  if (!userText || !finalText) throw new Error('07-fix 缺少用户输入或最终回答。');

  const result = rows[3].result;
  const parsed = result.item.output.flatMap((block, outputIndex) => {
    if (typeof block.text !== 'string' || !block.text.trim().startsWith('{')) return [];
    const value = JSON.parse(block.text);
    return [{ ...value, outputIndex }];
  });
  const checks = ['npm run typecheck', 'npm test', 'npm start'].map(command => {
    const entry = parsed.find(item => item.check === command);
    if (!entry || typeof entry.value?.exit_code !== 'number' || typeof entry.value?.output !== 'string') throw new Error(`07-fix 缺少 ${command} 的验证结果。`);
    return { command, exitCode: entry.value.exit_code, output: entry.value.output, path: `input[${result.inputIndex}].output[${entry.outputIndex}].text` };
  });
  return { rows, userText, finalText, checks, programOutput: checks[2].output };
}

export async function mountAgentLoopTimeline(container, { experiment, loadJson, evidenceHref, copyButton = () => '' }) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<p class="loop-loading">正在读取这次修复的五份请求与响应…</p>';
  let data;
  try { data = await buildAgentLoopData({ experiment, loadJson }); }
  catch (error) {
    container.innerHTML = `<p class="loop-loading" role="alert">修复时间线未能加载：${escapeHtml(error.message)}</p><a href="${escapeHtml(evidenceHref('03-agent-loop', '07-fix', 0, 'request'))}">打开完整证据工作台</a>`;
    container.setAttribute('aria-busy', 'false');
    throw error;
  }

  const link = (label, stageIndex, view, extra = {}, attrs = '') => `<a href="${escapeHtml(evidenceHref('03-agent-loop', experiment.id, stageIndex, view, extra))}" data-loop-view="${view}" data-loop-stage="${stageIndex}" ${attrs}>${escapeHtml(label)}<span aria-hidden="true"> ↗</span></a>`;
  const raw = (value, label, attrs = '') => {
    const text = typeof value === 'string' ? value : jsonText(value);
    return `<details class="loop-raw"><summary>${escapeHtml(label)}</summary><div class="loop-raw-actions">${copyButton(text, '复制原文')}</div><pre tabindex="0" ${attrs}><code>${originalText(text)}</code></pre></details>`;
  };
  const panels = data.rows.map(row => {
    const callLabel = row.call ? `C${row.order + 1}` : '';
    return `<article class="loop-panel" id="loop-panel-${row.order}" data-loop-panel="${row.order}" role="tabpanel" aria-labelledby="loop-tab-${row.order}" ${row.order ? 'hidden' : ''}>
      <header class="loop-panel-heading"><span class="loop-request-badge">R${row.order}</span><div><h4>${row.title}</h4><p>${escapeHtml(row.stage.id)} · <time datetime="${escapeHtml(row.stage.requestTimestamp)}">${escapeHtml(row.stage.requestTimestamp.slice(11, 19))} +08:00</time></p></div></header>
      <div class="loop-steps">
        <section class="loop-step"><span class="loop-step-label">模型收到</span><p>${row.inputSummary}</p>${link('本次新增输入', row.index, 'request', { input: 0 })}${raw(row.request.input, '展开本次 input 原文', 'data-loop-input')}</section>
        <section class="loop-step" ${row.call ? `data-loop-call-id="${escapeHtml(row.call.call_id)}"` : ''}><span class="loop-step-label">${row.call ? '模型提出工具调用' : '模型完成回答'}</span><p>${row.outputSummary}</p>${row.call ? `<p class="loop-call-label"><code>${callLabel}</code> · <code>${escapeHtml(row.call.name)}</code></p>` : ''}${link('本次模型输出', row.index, 'output')}${row.call ? raw(row.call.input, `展开 ${callLabel} 的完整调用代码`, 'data-loop-call-input') : raw(data.finalText, '展开最终回答原文', 'data-loop-panel-final-text')}</section>
        ${row.result ? `<section class="loop-step loop-result" data-loop-result-call-id="${escapeHtml(row.call.call_id)}" data-loop-result-stage="${row.result.stageIndex}"><span class="loop-step-label">本地执行与结果回传</span><p>${row.feedback}</p><p class="loop-result-destination">${callLabel} 的结果进入 <strong>R${row.result.order}</strong>，位置为 <code>input[${row.result.inputIndex}]</code>。</p>${link(`查看 R${row.result.order} 中的返回结果`, row.result.stageIndex, 'request', { input: row.result.inputIndex }, 'data-loop-result-link')}${raw(row.result.item, '展开完整返回项目（含 call_id）', 'data-loop-result-item')}</section>` : `<section class="loop-step loop-result"><span class="loop-step-label">本轮结束</span><p>验证结果已经到达，最后的响应给出完成说明。没有第五次工具调用。</p>${link('核对最终验证输入', row.index, 'request', { input: 0 })}</section>`}
      </div>
      <details class="loop-identities"><summary>响应与调用编号</summary><dl><div><dt>response.id</dt><dd><code>${escapeHtml(row.response.id)}</code></dd></div><div><dt>previous_response_id</dt><dd><code>${escapeHtml(row.request.previous_response_id || '本请求未携带')}</code></dd></div>${row.call ? `<div><dt>call_id</dt><dd><code>${escapeHtml(row.call.call_id)}</code></dd></div>` : ''}</dl></details>
      <nav class="loop-evidence-links" aria-label="R${row.order} 完整日志">${link('输入', row.index, 'request')}${link('输出', row.index, 'output')}${link('调用与结果配对', row.index, 'calls')}${link('完整原始请求', row.index, 'raw', { kind: 'requestFile' })}</nav>
    </article>`;
  }).join('');

  const finalStage = data.rows.at(-1).index;
  container.innerHTML = `<header class="loop-heading"><div><p class="loop-eyebrow">真实请求时间线 · 07-fix</p><h3>一次修复，五次模型请求</h3></div><span class="loop-count">5 次请求 / 4 次工具往返</span></header>
    <p class="loop-intro">选择一个请求，查看模型收到什么、提出了什么动作，以及结果送到了哪一次请求。</p>
    <section class="loop-user"><span class="loop-step-label">用户输入 · 这一轮的起点</span><pre data-loop-user-text><code>${originalText(data.userText)}</code></pre>${link('定位 R0 的用户消息', data.rows[0].index, 'request', { input: 0 })}</section>
    <div class="loop-reader"><div class="loop-stage-list" role="tablist" aria-label="选择模型请求" aria-orientation="vertical">${data.rows.map(row => `<button type="button" id="loop-tab-${row.order}" role="tab" data-loop-select="${row.order}" aria-controls="loop-panel-${row.order}" aria-selected="${row.order === 0}" tabindex="${row.order === 0 ? 0 : -1}"><span class="loop-stage-dot">R${row.order}</span><span><strong>${row.title}</strong><small>${row.call ? `提出 C${row.order + 1} → 结果交给 R${row.order + 1}` : '最终回答 · 无新调用'}</small></span></button>`).join('')}</div><div class="loop-panels">${panels}<div class="loop-navigation"><button type="button" data-loop-prev disabled>上一次请求</button><span data-loop-position aria-live="polite">R0 / R4</span><button type="button" data-loop-next>下一次请求</button></div></div></div>
    <section class="loop-finish"><div class="loop-finish-heading"><span class="loop-step-label">验证结果 · R4 已收到</span>${link('打开原验证结果', finalStage, 'request', { input: 0 })}</div><div class="loop-checks">${data.checks.map(check => `<div data-loop-check="${escapeHtml(check.command)}" data-loop-exit-code="${check.exitCode}"><code>${escapeHtml(check.command)}</code><span class="${check.exitCode === 0 ? 'loop-check-pass' : 'loop-check-fail'}">退出码 ${check.exitCode}</span></div>`).join('')}</div><p class="loop-output-label">npm start 的实际输出</p><pre class="loop-program-output" data-loop-program-output><code>${originalText(data.programOutput)}</code></pre>${raw(data.finalText, '查看模型最终回答原文', 'data-loop-final-text')}<p class="loop-source-note">上方退出码与程序输出来自 R4 的工具返回；最终回答来自 R4 的输出项。</p></section>`;

  let selected = 0;
  const select = (index, focus = false) => {
    if (!Number.isInteger(index) || index < 0 || index >= data.rows.length) return;
    selected = index;
    container.querySelectorAll('[data-loop-select]').forEach(button => {
      const active = Number(button.dataset.loopSelect) === index;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    container.querySelectorAll('[data-loop-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.loopPanel) !== index; });
    container.querySelector('[data-loop-prev]').disabled = index === 0;
    container.querySelector('[data-loop-next]').disabled = index === data.rows.length - 1;
    container.querySelector('[data-loop-position]').textContent = `R${index} / R4`;
  };
  container.addEventListener('click', event => {
    const tab = event.target.closest('[data-loop-select]');
    if (tab && container.contains(tab)) select(Number(tab.dataset.loopSelect));
    else if (event.target.closest('[data-loop-prev]')) select(selected - 1);
    else if (event.target.closest('[data-loop-next]')) select(selected + 1);
  });
  container.addEventListener('keydown', event => {
    if (!event.target.closest('[data-loop-select]')) return;
    const next = { ArrowDown: (selected + 1) % data.rows.length, ArrowRight: (selected + 1) % data.rows.length, ArrowUp: (selected + data.rows.length - 1) % data.rows.length, ArrowLeft: (selected + data.rows.length - 1) % data.rows.length, Home: 0, End: data.rows.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); select(next, true); }
  });
  container.setAttribute('aria-busy', 'false');
}
