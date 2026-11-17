const state = {
  jobs: [],
  collection: null,
  collector: null,
  tab: 'daily',
  selected: null,
  dailyDate: '',
};

const tabs = {
  daily: '每日岗位',
  all: '持续岗位',
  archive: '岗位归档',
};

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

let collectionTimer;

async function api(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `请求失败（${response.status}）`;
    throw new Error(detail);
  }
  return body;
}

async function load() {
  clearTimeout(collectionTimer);
  try {
    [state.jobs, state.collection, state.collector] = await Promise.all([
      api('/api/jobs'),
      api('/api/collection/status'),
      api('/api/collector/status').catch(() => null),
    ]);
    if (!state.dailyDate) {
      state.dailyDate = state.jobs.map(job => job.batch_date).sort().at(-1) || '';
    }
    render();
  } catch (error) {
    if ($('#status')) {
      showError(error);
    } else {
      $('#app').innerHTML = `<div class="empty"><p role="alert">${escapeHtml(error.message)}</p>
        <button type="button" onclick="load()">重试</button></div>`;
    }
  } finally {
    collectionTimer = setTimeout(load, state.collection?.running ? 3000 : 10000);
  }
}

function render() {
  const active = state.jobs.filter(job => job.is_valid);
  const unread = active.filter(job => !job.is_read);
  $('#app').innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand">求职 Agent</div>
        <nav aria-label="岗位视图">
          ${Object.entries(tabs).map(([id, label]) =>
            `<button type="button" class="nav ${state.tab === id ? 'active' : ''}"
              aria-pressed="${state.tab === id}" onclick="switchTab('${id}')">${label}</button>`
          ).join('')}
        </nav>
      </aside>
      <main class="main">
        <div class="top">
          <div><h1>产品求职工作台</h1><span class="muted">杭州优先 · 宁波其次 · 上海</span></div>
          <button type="button" onclick="load()">刷新</button>
        </div>
        <div class="cards">
          <div class="stat">有效岗位<b>${active.length}</b></div>
          <div class="stat">未读岗位<b>${unread.length}</b></div>
          <div class="stat">已归档岗位<b>${state.jobs.length - active.length}</b></div>
        </div>
        <p id="status" class="danger" role="alert" hidden></p>
        ${collectionBar()}
        ${view()}
      </main>
    </div>`;
}

function collectionBar() {
  const collection = state.collection || {};
  const run = collection.run || {};
  const extension = state.collector || collection.extension || {};
  const extensionText = extension.online
    ? `扩展在线 · BOSS ${extension.logged_in ? '已登录' : '待登录/验证'}`
    : '扩展离线 · 首次使用请在 Chrome 安装扩展';
  let status = collection.progress?.message || run.message || '尚未进行采集';
  if (run.status === 'success') {
    status = `上次成功：新增 ${run.new_count}，更新 ${run.updated_count}，过滤 ${run.filtered_count}，归档 ${run.archived_count}`;
  }
  return `
    <div class="collection-bar ${escapeHtml(run.status)}">
      <div><strong>BOSS 岗位采集</strong>
        <div class="muted">${escapeHtml(extensionText)} · ${escapeHtml(status)}</div>
      </div>
      <div class="row">
        ${extension.online ? '' : '<button type="button" class="secondary" onclick="openExtensionSetup()">① 安装采集扩展</button>'}
        <a href="https://www.zhipin.com/web/geek/jobs?query=%E4%BA%A7%E5%93%81&amp;city=101210100" target="_blank" rel="noopener noreferrer">② 打开 BOSS</a>
        <button type="button" ${collection.running ? 'disabled' : ''} onclick="collectBoss(this)">
          ${collection.running ? '任务进行中…' : '立即采集'}
        </button>
      </div>
    </div>`;
}

async function openExtensionSetup() {
  try {
    const result = await api('/api/collection/open-extension-setup', { method: 'POST' });
    alert(`在 Chrome 地址栏输入 chrome://extensions/，开启开发者模式，选择“加载已解压的扩展程序”，然后选中此文件夹：\n${result.extension_path}`);
  } catch (error) {
    showError(error);
  }
}

async function collectBoss(button) {
  button.disabled = true;
  try {
    await api('/api/collection/start', {
      method: 'POST',
      body: JSON.stringify({ visible: true }),
    });
    await load();
  } catch (error) {
    showError(error);
  } finally {
    if (!state.collection?.running) button.disabled = false;
  }
}

function switchTab(tab) {
  state.tab = tab;
  state.selected = null;
  render();
}

function selectDailyDate(date) {
  state.dailyDate = date;
  state.selected = null;
  render();
}

function view() {
  const isDaily = state.tab === 'daily';
  const isArchive = state.tab === 'archive';
  const jobs = state.jobs.filter(job =>
    isArchive ? !job.is_valid : job.is_valid && (!isDaily || job.batch_date === state.dailyDate)
  );
  const selected = jobs.find(job => job.id === state.selected);
  const emptyMessage = isDaily ? '该日期没有岗位记录。' : '暂无岗位记录。';
  return `
    <div class="grid">
      <section>
        <div class="panel">
          <div class="row">
            <h2>${tabs[state.tab]}</h2><span class="muted">共 ${jobs.length} 个</span>
            ${isDaily ? `<label class="row">查看日期 <input type="date" value="${escapeHtml(state.dailyDate)}"
              onchange="selectDailyDate(this.value)"></label>` : ''}
          </div>
          ${jobs.map(jobCard).join('') || `<div class="empty">${emptyMessage}</div>`}
        </div>
      </section>
      <section class="panel detail">
        ${selected ? detail(selected) : '<div class="empty">选择一个岗位查看详情</div>'}
      </section>
    </div>`;
}

function jobCard(job) {
  return `
    <div class="job" onclick="selectJob(${job.id})">
      <div class="row" style="justify-content:space-between">
        <h3>${escapeHtml(job.title)}</h3><span class="tag">匹配 ${escapeHtml(job.match_score)}%</span>
      </div>
      <div>${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(job.salary)}</div>
      <div class="muted">${job.is_read ? '已读' : '未读'} · ${escapeHtml(job.experience || '经验未知')}
        · ${escapeHtml(job.education || '学历未知')} · ${escapeHtml(job.batch_date)}</div>
    </div>`;
}

async function selectJob(id) {
  const job = state.jobs.find(item => item.id === id);
  state.selected = id;
  render();
  if (job.is_read) return;
  try {
    await api(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read: true }),
    });
    const current = state.jobs.find(item => item.id === id);
    if (current) current.is_read = true;
    render();
  } catch (error) {
    showError(error);
  }
}

function detail(job) {
  const bossLink = /^https?:\/\//i.test(job.source_url)
    ? `<a href="${escapeHtml(job.source_url)}" target="_blank" rel="noopener noreferrer">打开 BOSS 页面</a>`
    : '';
  const action = job.is_valid ? '归档岗位' : '恢复为有效岗位';
  return `
    <h2>${escapeHtml(job.title)}</h2>
    <p>${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(job.salary)}</p>
    <div class="row"><span class="tag">匹配 ${escapeHtml(job.match_score)}%</span>${bossLink}</div>
    <hr><h3>岗位描述（JD）</h3><p class="jd-text">${escapeHtml(job.jd_content)}</p><hr>
    <button type="button" class="secondary" onclick="setJobValid(${job.id}, ${!job.is_valid}, this)">${action}</button>`;
}

async function setJobValid(id, isValid, button) {
  button.disabled = true;
  try {
    await api(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_valid: isValid }),
    });
    if (state.selected === id) state.selected = null;
    await load();
  } catch (error) {
    button.disabled = false;
    showError(error);
  }
}

function showError(error) {
  const message = $('#status');
  message.textContent = error.message;
  message.hidden = false;
}

load();
