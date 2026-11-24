// Iteration 2: resume editing and PDF confirmation, compatible with iteration 1 APIs.
const state = {
  jobs: [], resumes: [], collection: null, collector: null, ai: null,
  resumeApiReady: false, tab: 'daily', selected: null, tailored: null,
  jobDraft: null, sourceResume: null, previewMode: 'tailored',
  tailoring: false, tailorError: '', dailyDate: '', readOnly: false,
  resumeNotice: '', confirmed: null,
};
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

async function api(url, options = {}) {
  const response = await fetch(url, { ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const raw = await response.text();
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = raw; }
  if (!response.ok) {
    const error = new Error(typeof body?.detail === 'string' ? body.detail : `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return body;
}

let collectionTimer = null;
let loading = false;
async function load() {
  if (loading) return;
  loading = true;
  clearTimeout(collectionTimer);
  try {
    // Resume endpoints become available after the separately reviewed backend PR.
    const [jobs, collection, collector, resumes, ai] = await Promise.all([
      api('/api/jobs'), api('/api/collection/status'),
      api('/api/collector/status').catch(() => ({ online: false })),
      api('/api/resumes').then(items => ({ items, ready: true })).catch(error => ({
        items: [], ready: false, message: error.status === 404
          ? '简历功能暂不可用，请稍后刷新。' : '简历暂时加载失败，请稍后刷新。',
      })),
      api('/api/ai/status').catch(() => ({ configured: false, model: '' })),
    ]);
    Object.assign(state, { jobs, collection, collector, resumes: resumes.items,
      resumeApiReady: resumes.ready, resumeNotice: resumes.message || '', ai });
    if (!state.dailyDate) state.dailyDate = [...new Set(jobs.map(job => job.batch_date))].sort().at(-1) || '';
    const confirmedId = new URLSearchParams(location.search).get('confirmed_tailored');
    if (confirmedId && state.resumeApiReady) {
      try {
        const document = await api(`/api/tailored/${encodeURIComponent(confirmedId)}`);
        state.confirmed = document.status === 'pdf_confirmed' ? document : null;
        if (!state.confirmed) state.resumeNotice = '这份简历需要重新导出并确认 PDF。';
      } catch (_) { state.resumeNotice = '无法加载 PDF 确认结果，请重新打开简历检查。'; }
    }
    render();
  } finally {
    loading = false;
    collectionTimer = setTimeout(() => load().catch(showLoadError), state.collection?.running ? 3000 : 10000);
  }
}

function showLoadError(error) {
  const message = '页面暂时无法加载，请确认服务已启动后刷新。';
  if (!state.jobs.length) $('#app').innerHTML = `<div class="empty">${esc(message)}</div>`;
}

function render() {
  const unread = state.jobs.filter(job => job.is_valid && !job.is_read).length;
  $('#app').innerHTML = `<div class="shell"><aside class="side"><div class="brand">求职 Agent</div>
    ${[['daily','每日岗位'],['all','持续岗位'],['archive','岗位归档'],['resumes','通用简历']].map(([tab,label]) =>
      `<div class="nav ${state.tab === tab ? 'active' : ''}" onclick="switchTab('${tab}')">${label}</div>`).join('')}
    </aside><main class="main"><div class="top"><div><h1>产品求职工作台</h1><span class="muted">杭州优先 · 宁波其次 · 上海</span></div><button onclick="refreshWorkbench()">刷新</button></div>
    <div class="cards"><div class="stat">有效岗位<b>${state.jobs.filter(job => job.is_valid).length}</b></div>
    <div class="stat">未读岗位<b>${unread}</b></div><div class="stat">已归档岗位<b>${state.jobs.filter(job => !job.is_valid).length}</b></div>
    <div class="stat">简历版本<b>${state.resumeApiReady ? state.resumes.length : '—'}</b></div></div>
    ${state.resumeNotice ? `<div class="panel resume-notice" role="status">${esc(state.resumeNotice)}</div>` : ''}
    ${confirmationResult()}${collectionBar()}${view()}</main></div>`;
}

function refreshWorkbench() { return load().catch(error => alert(error.message)); }
function switchTab(tab) {
  if (tab === 'resumes') {
    if (!state.resumeApiReady) return alert(state.resumeNotice || '简历功能暂不可用，请稍后刷新。');
    location.href = '/static/resume-formatter.html';
    return;
  }
  state.tab = tab; state.selected = null; state.tailored = null;
  state.jobDraft = null; state.sourceResume = null; state.previewMode = 'tailored';
  render();
}

function confirmationResult() {
  if (!state.confirmed) return '';
  return `<section class="panel pdf-confirmation" role="status"><h2>PDF 已确认</h2>
    <p>定制简历 #${state.confirmed.id} 已记录为 PDF 已确认。请保留你下载的 PDF 文件。</p>
    <button onclick="openConfirmedResume()">查看已确认简历</button>
    <button class="secondary" onclick="dismissConfirmation()">关闭提示</button></section>`;
}
function dismissConfirmation() {
  state.confirmed = null;
  const url = new URL(location.href); url.searchParams.delete('confirmed_tailored');
  history.replaceState(null, '', url); render();
}
function openConfirmedResume() {
  if (state.confirmed) window.open(`/static/resume-formatter.html?tailored=${state.confirmed.id}`, '_blank');
}

function view() {
  if (state.selected && state.tailored) return resumeWorkspace();
  const archived = state.tab === 'archive', daily = state.tab === 'daily';
  const jobs = state.jobs.filter(job => archived ? !job.is_valid : job.is_valid && (!daily || job.batch_date === state.dailyDate));
  const title = archived ? '岗位归档' : daily ? '每日更新' : '持续岗位';
  return `<div class="grid"><section><div class="panel"><div class="row"><h2>${title}</h2><span class="muted">共 ${jobs.length} 个</span>
    ${daily ? `<label class="row">查看日期 <input type="date" value="${esc(state.dailyDate)}" onchange="selectDailyDate(this.value)"></label>` : ''}</div>
    ${jobs.map(jobCard).join('') || '<div class="empty">该日期没有岗位记录。</div>'}</div></section>
    <section class="panel detail">${state.selected ? detail() : '<div class="empty">选择一个岗位查看详情</div>'}</section></div>`;
}

async function selectJob(id) {
  state.selected = state.jobs.find(job => job.id === id);
  state.tailored = null; state.jobDraft = null; state.sourceResume = null;
  state.previewMode = 'tailored'; state.tailorError = '';
  try {
    await api(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    state.selected.is_read = true;
    if (state.resumeApiReady) {
      const drafts = await api(`/api/jobs/${id}/tailored`);
      if (state.selected?.id === id) state.jobDraft = drafts[0] || null;
    }
    render();
  } catch (error) { alert(error.message); render(); }
}

function detail() {
  const job = state.selected, draft = state.jobDraft;
  const canTailor = state.resumeApiReady && state.resumes.length > 0 && state.ai?.configured;
  const aiHint = !state.resumeApiReady ? state.resumeNotice
    : !state.resumes.length ? '请先在“通用简历”中新建或上传一个版本。'
    : state.ai?.configured ? `DeepSeek 已连接 · ${state.ai.model || ''}` : 'AI 定制暂不可用，请检查服务配置。';
  return `<h2>${esc(job.title)}</h2><p>${esc(job.company)} · ${esc(job.location)} · ${esc(job.salary)}</p>
    <p class="muted">${esc(job.experience || '经验未知')} · ${esc(job.education || '学历未知')} · ${esc(job.source_name || 'BOSS直聘')}</p>
    <div class="row"><span class="tag">匹配 ${job.match_score}%</span><a href="${esc(job.source_url)}" target="_blank" rel="noopener noreferrer">打开 BOSS 页面</a></div>
    <hr><h3>JD</h3><p class="jd-text">${esc(job.jd_content)}</p><hr><h3>操作</h3>
    ${!job.is_valid ? `<p class="danger">该岗位已归档。</p><button onclick="setJobValid(${job.id},true)">恢复为有效岗位</button>` :
      `<div class="ai-status">${esc(aiHint)}</div><div class="row"><select id="resumeSelect" ${state.tailoring ? 'disabled' : ''}>
      ${state.resumes.map(resume => `<option value="${resume.id}" ${draft?.source_resume_id === resume.id ? 'selected' : ''}>${esc(resume.name)}</option>`).join('')}</select>
      <button onclick="tailor()" ${state.tailoring || !canTailor ? 'disabled' : ''}>${state.tailoring ? 'DeepSeek 正在生成…' : draft ? '重新生成定制简历' : '根据岗位生成简历'}</button>
      ${draft ? `<button class="secondary" onclick="editExistingTailored()">编辑定制简历</button><span class="tag">${draft.status === 'pdf_confirmed' ? 'PDF 已确认' : '待编辑 / 确认'}</span>` : ''}
      <button class="secondary" onclick="setJobValid(${job.id},false)">归档关闭岗位</button></div>
      ${state.tailoring ? '<p class="muted">正在分析岗位要求并核对简历经历，请稍候。</p>' : ''}
      ${state.tailorError ? `<p class="ai-error" role="alert">${esc(state.tailorError)}</p>` : ''}`}`;
}

async function tailor() {
  const resumeId = Number($('#resumeSelect')?.value), jobId = state.selected?.id;
  if (!jobId || !resumeId || !state.resumeApiReady) return;
  state.tailoring = true; state.tailorError = ''; render();
  try {
    const document = await api(`/api/jobs/${jobId}/tailor`, { method: 'POST', body: JSON.stringify({ resume_id: resumeId }) });
    localStorage.removeItem(`resume-formatter:tailored:${document.id}`);
    if (state.selected?.id === jobId) {
      state.tailored = document; state.jobDraft = document;
      state.sourceResume = state.resumes.find(resume => resume.id === resumeId) || null;
      state.previewMode = 'tailored'; state.readOnly = false;
    }
  } catch (error) { state.tailorError = error.message || '定制简历生成失败'; }
  finally { state.tailoring = false; render(); }
}

function setPreviewMode(mode) { state.previewMode = mode; render(); }
function editExistingTailored() {
  state.tailored = state.jobDraft;
  state.sourceResume = state.resumes.find(resume => resume.id === state.jobDraft.source_resume_id) || null;
  state.previewMode = 'tailored'; state.readOnly = false; openEditor();
}
function openEditor() {
  if (state.tailored) window.open(`/static/resume-formatter.html?tailored=${state.tailored.id}`, '_blank');
}
async function refreshTailored() {
  try {
    state.tailored = await api(`/api/tailored/${state.tailored.id}`);
    state.jobDraft = state.tailored; render();
  } catch (error) { alert(error.message); }
}
function closeResume() {
  state.tailored = null; state.sourceResume = null; state.previewMode = 'tailored'; render();
}

function collectionBar(){let c=state.collection||{},r=c.run||{},p=c.progress||{},ext=state.collector||c.extension||{};let status=!r.id?'尚未进行真实采集':r.status==='queued'?(r.message||'等待扩展领取任务'):r.status==='running'?(p.message||r.message):r.status==='success'?`上次成功：新增 ${r.new_count}，更新 ${r.updated_count}，过滤 ${r.filtered_count}，归档 ${r.archived_count}`:r.status==='needs_login'?(r.message||'需要登录或人工验证'):r.status==='partial'?`部分完成：新增 ${r.new_count}；${r.message||'未归档旧岗位'}`:r.message||'上次采集失败';let extText=ext.online?`扩展在线 v${ext.version||'未知'} · BOSS ${ext.logged_in?'已登录':'待登录/验证'}${''}`:'扩展离线 · 首次使用请在当前 Chrome 安装扩展';let busy=['queued','running'].includes(r.status);let setup=ext.online?'':`<button class="secondary" onclick="openExtensionSetup()">① 打开扩展文件夹</button>`;return `<div class="collection-bar ${r.status||''}"><div><strong>BOSS 岗位采集</strong><div class="muted">${esc(extText)} · ${esc(status)} · 每天 18:00 自动更新</div></div><div class="row">${setup}<button class="secondary" onclick="openBossLogin()">② 打开 BOSS</button><button ${busy?'disabled':''} onclick="collectBoss()">${busy?'任务进行中…':'立即采集'}</button></div></div>`}

function openBossLogin(){window.open('https://www.zhipin.com/web/geek/jobs?query=%E4%BA%A7%E5%93%81&city=101210100&industry=&position=','_blank')}

async function openExtensionSetup(){let result=await api('/api/collection/open-extension-setup',{method:'POST',body:'{}'});alert(`${result.message}\n\n需要选择的文件夹：${result.extension_path}`);setTimeout(load,3000)}

async function collectBoss(){let offline=!state.collector?.online;await api('/api/collection/start',{method:'POST',body:JSON.stringify({visible:true})});await load();if(offline)alert('采集任务已排队。请先在当前 Chrome 安装并启用扩展，扩展上线后会自动开始。')}

function selectDailyDate(date){state.dailyDate=date;state.selected=null;state.tailored=null;state.jobDraft=null;render()}

function jobCard(j){return `<div class="job" onclick="selectJob(${j.id})"><div class="row" style="justify-content:space-between"><h3>${esc(j.title)}</h3><span class="tag">匹配 ${j.match_score}%</span></div><div>${esc(j.company)} · ${esc(j.location)} · ${esc(j.salary)}</div><div class="muted">${j.is_read?'已读':'未读'} · ${esc(j.experience||'经验未知')} · ${esc(j.education||'学历未知')} · ${j.batch_date}</div></div>`}

async function setJobValid(id,is_valid){await api(`/api/jobs/${id}`,{method:'PATCH',body:JSON.stringify({is_valid})});state.selected=null;await load()}

function safeJson(value,fallback){try{return JSON.parse(value)}catch(_){return fallback}}

function inlineMd(value){return esc(value).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}

function resumePreviewHtml(content){let lines=String(content||'').split(/\r?\n/),front={},start=0;if(lines[0]?.trim()==='---'){let end=lines.slice(1).findIndex(x=>x.trim()==='---');if(end>=0){for(let line of lines.slice(1,end+1)){let at=line.indexOf(':');if(at>0)front[line.slice(0,at).trim()]=line.slice(at+1).trim()}start=end+2}}let names={education:'教育背景',experience:'实习/工作经历',projects:'项目经历',skills:'技能特长',custom:'其他信息'},html='';if(front.name||front.headline){html+=`<header class="resume-preview-header"><h1>${inlineMd(front.name||'')}</h1>${front.headline?`<div>${inlineMd(front.headline)}</div>`:''}<p>${[front.location,front.phone,front.email,front.website,front.portfolio,front.github].filter(Boolean).map(inlineMd).join(' · ')}</p></header>`}let inList=false;for(let raw of lines.slice(start)){let line=raw.trim();if(!line)continue;if(line.startsWith('## ')){if(inList){html+='</ul>';inList=false}let key=line.slice(3).trim();html+=`<h2 class="resume-section-title">${esc(names[key]||key)}</h2>`}else if(line.startsWith('### ')){if(inList){html+='</ul>';inList=false}html+=`<h3 class="resume-entry-title">${inlineMd(line.slice(4))}</h3>`}else if(/^title:\s*/.test(line)){continue}else if(/^(role|date|location):\s*/.test(line)){let [key,...rest]=line.split(':');html+=`<div class="resume-meta"><b>${{role:'角色',date:'时间',location:'地点'}[key]}</b> ${inlineMd(rest.join(':').trim())}</div>`}else if(/^[-•▪►]\s*/.test(line)){if(!inList){html+='<ul>';inList=true}html+=`<li>${inlineMd(line.replace(/^[-•▪►]\s*/,''))}</li>`}else{if(inList){html+='</ul>';inList=false}html+=`<p>${inlineMd(line)}</p>`}}if(inList)html+='</ul>';return html||'<p class="muted">暂无内容</p>'}

function requirementItems(items,type){return (Array.isArray(items)?items:[]).map(item=>`<li><span class="requirement-label ${type}">${type==='explicit'?'明确':'推测'}</span>${esc(item)}</li>`).join('')}

function requirementSummary(req){if(!req||typeof req!=='object')return '<p class="muted">暂无岗位要求总结</p>';let explicit=requirementItems(req.explicit_requirements,'explicit'),inferred=requirementItems(req.inferred_requirements,'inferred');return `<div class="requirement-summary"><p>${esc(req.overview||'暂无概括')}</p>${req.hard_requirements?.length?`<div class="hard-requirements"><strong>已获取的硬条件</strong>：${req.hard_requirements.map(esc).join(' · ')}</div>`:''}${explicit||inferred?`<ul>${explicit}${inferred}</ul>`:''}${req.tailoring_focus?.length?`<div><strong>简历重点</strong>：${req.tailoring_focus.map(esc).join('、')}</div>`:''}${req.information_note?`<small>${esc(req.information_note)}</small>`:''}</div>`}

function resumeWorkspace(){let t=state.tailored,rawKeys=safeJson(t.keywords,[]),risks=safeJson(t.risks,[]),reason=safeJson(t.reason,null);let analysis=reason&&typeof reason==='object'?reason:{summary:t.reason||'',changes:[]};let keys=(Array.isArray(rawKeys)?rawKeys:[]).map(k=>typeof k==='string'?{keyword:k,covered:true,evidence:''}:k);let source=state.sourceResume||state.resumes.find(r=>r.id===t.source_resume_id),showOriginal=state.previewMode==='original',preview=showOriginal?(source?.content||''):t.content;let changes=Array.isArray(analysis.changes)?analysis.changes:[];return `<div class="resume-workspace"><section><div class="row toolbar"><button class="secondary" onclick="closeResume()">← 返回岗位</button><button class="${showOriginal?'secondary':''}" onclick="setPreviewMode('tailored')">修改后的简历</button><button class="${showOriginal?'':'secondary'}" onclick="setPreviewMode('original')">原始简历 · ${esc(source?.name||'所选版本')}</button>${!state.readOnly?'<button onclick="openEditor()">编辑定制简历（新标签页）</button><button class="secondary" onclick="refreshTailored()">刷新预览</button>':'<span class="tag">已确认的 PDF 版本</span>'}</div><div class="a4-wrap"><article class="a4-page resume-document" contenteditable="false">${resumePreviewHtml(preview)}</article></div>${!state.readOnly?'<p class="muted">新标签页中的 A4 排版与最终导出一致；保存会覆盖此岗位当前草稿，导出并核对 PDF 后，再确认最终版本。</p>':''}</section><aside class="panel resume-insights"><h2>${esc(state.selected.title)}</h2><p>${esc(state.selected.company)} · ${esc(state.selected.location)}</p><h3>岗位要求总结</h3>${requirementSummary(analysis.job_requirements)}<h3>定制策略</h3><p>${esc(analysis.summary||'暂无说明')}</p><h3>修改原因</h3>${changes.length?changes.map(change=>`<div class="change-card"><strong>${esc(change.section||'内容调整')} · ${esc(change.change_type||'润色')}</strong>${change.original?`<div class="change-before">原：${esc(change.original)}</div>`:''}${change.revised?`<div class="change-after">改：${esc(change.revised)}</div>`:''}<div class="muted">${esc(change.reason||'')}</div></div>`).join(''):'<p class="muted">本次没有可安全进行的实质改写，已保留原文。</p>'}<h3>岗位关键词覆盖</h3><div class="coverage-list">${keys.length?keys.map(k=>`<div class="coverage ${k.covered?'covered':'missing'}"><span>${k.covered?'✓':'!'} ${esc(k.keyword)} ${k.inferred?'<em>推测</em>':''}</span>${k.evidence?`<small><b>原文证据：</b>${esc(k.evidence)}</small>`:''}${k.explanation?`<small>${esc(k.explanation)}</small>`:''}</div>`).join(''):'<p class="muted">暂无识别关键词</p>'}</div><h3>可能存在的风险</h3>${risks.length?`<ul class="risk-list">${risks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:'<p>暂无明显风险</p>'}</aside></div>`}

load().catch(showLoadError);
