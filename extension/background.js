const API_ROOT = 'http://127.0.0.1:8000/api/collector';
const VERSION = '1.3.0';
const CITY_HOME = {
  '杭州': 'https://www.zhipin.com/hangzhou/?seoRefer=index',
  '宁波': 'https://www.zhipin.com/ningbo/?seoRefer=index',
  '上海': 'https://www.zhipin.com/shanghai/?seoRefer=index',
};

let collectorToken = '';
let collecting = false;
let claiming = false;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function bootstrap() {
  if (collectorToken) return;
  const response = await fetch(`${API_ROOT}/bootstrap`);
  if (!response.ok) throw new Error(`本地 Agent 连接失败（${response.status}）`);
  const data = await response.json();
  collectorToken = data.token;
}

async function api(path, options = {}) {
  await bootstrap();
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Collector-Token': collectorToken,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `本地 Agent 请求失败（${response.status}）`);
  }
  return response.json();
}

async function bossTabs() {
  return chrome.tabs.query({ url: ['https://www.zhipin.com/*'] });
}

async function ensureBossTab() {
  const tabs = await bossTabs();
  if (tabs.length) return tabs.find(tab => tab.active) || tabs[0];
  return chrome.tabs.create({ url: 'https://www.zhipin.com/', active: true });
}

async function waitForTab(tabId, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      await delay(800);
      return tab;
    }
    await delay(250);
  }
  throw new Error('页面加载超时');
}

async function navigate(tabId, url, active = false) {
  await chrome.tabs.update(tabId, { url, active });
  return waitForTab(tabId);
}

async function execute(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return results[0]?.result;
}

async function executeAllFrames(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true }, func, args,
  });
  return results.map(item => ({ frame_id: item.frameId, result: item.result }));
}

async function executeFrame(tabId, frameId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] }, func, args,
  });
  return results[0]?.result;
}

async function waitForCards(tabId, cityName, timeout = 18000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await execute(tabId, inspectPage);
    if (state?.needs_login || state?.blocked) return { state, cards: [] };
    const cards = await execute(tabId, extractCards, [cityName]) || [];
    if (cards.length) return { state, cards };
    await delay(600);
  }
  return { state: await execute(tabId, inspectPage), cards: [] };
}

function inspectPage() {
  const visible = element => Boolean(element && element.getClientRects().length);
  const text = document.body?.innerText || '';
  const loginSelectors = [
    '.login-dialog', '.login-box', '.sign-form', '[class*="login-dialog"]',
    'form[action*="login"]', '[class*="login-form"]',
  ];
  const loginVisible = loginSelectors.some(selector => visible(document.querySelector(selector)));
  const loginText = /扫码登录|手机号登录|密码登录|请先登录/.test(text)
    && !/职位描述|职位详情|岗位职责|职位要求/.test(text);
  const blocked = /环境异常|访问异常|安全验证|请完成验证|验证码/.test(text);
  const loggedInMarker = Boolean(document.querySelector(
    '.nav-figure, .user-nav, [ka="header-personal"], a[href*="/web/geek/recommend"]'
  )) || /退出登录/.test(text);
  return {
    url: location.href,
    title: document.title,
    needs_login: loginVisible || loginText || /\/(login|web\/user)(\/|\?|$)/.test(location.pathname),
    blocked,
    logged_in: loggedInMarker && !loginVisible,
  };
}

function extractCards(cityName) {
  const decode = value => String(value || '').replace(/[\uE031-\uE03A]/g,
    char => String(char.charCodeAt(0) - 0xE031));
  const nodeText = node => decode(node?.innerText || node?.textContent).trim();
  const cards = Array.from(document.querySelectorAll('.job-card-wrapper, .job-card-box'));
  return cards.map(card => {
    const text = selector => nodeText(card.querySelector(selector));
    const leaves = Array.from(card.querySelectorAll('*'))
      .filter(node => node.children.length === 0).map(nodeText).filter(Boolean);
    const tags = Array.from(card.querySelectorAll(
      '.job-info li, .tag-list li, .job-card-footer .tag-list li'
    )).map(nodeText).filter(Boolean);
    const anchor = card.querySelector('a[href*="job_detail"]');
    const allText = decode(card.innerText || card.textContent);
    const salary = [text('.salary, .job-salary, [class*="salary"]'), ...leaves, allText]
      .map(value => value.match(/(?:\d{1,3}(?:\.\d+)?-\d{1,3}(?:\.\d+)?K(?:·\d{1,2}薪)?|\d{1,4}-\d{1,4}元\/(?:天|时)|面议)/i)?.[0] || '')
      .find(Boolean) || '';
    return {
      title: text('.job-name, [class*="job-name"]'),
      company: text('.company-name, [class*="company-name"]') || nodeText(card.querySelector('a[href*="/gongsi/"]')),
      location: text('.job-area, .job-location, [class*="area"]')
        || leaves.find(value => value === cityName || value.startsWith(`${cityName}·`)) || '',
      salary,
      source_url: anchor?.href || '',
      experience: tags.find(value => /经验|应届|年|不限/.test(value)) || '',
      education: tags.find(value => /学历不限|大专|本科|硕士|博士/.test(value)) || '',
      tags,
      city: cityName,
    };
  }).filter(job => job.title && job.source_url);
}

function scrollList() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  return document.documentElement.scrollHeight;
}

function paginationInfo() {
  const containers = Array.from(document.querySelectorAll(
    '.options-pages, .pagination, [class*="pagination"], [class*="page-list"]'
  ));
  const elements = containers.flatMap(container => Array.from(
    container.querySelectorAll('a, button')
  ));
  const numeric = elements.map(element => Number(element.textContent.trim()))
    .filter(Number.isFinite).filter(value => value > 0);
  const currentElement = elements.find(element =>
    /(^|\s)(active|selected|current)(\s|$)/.test(element.className || '')
    || element.getAttribute('aria-current') === 'page'
  );
  const current = Number(currentElement?.textContent.trim()) || 1;
  const next = elements.find(element => {
    const label = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`;
    return /下一页|next/i.test(label) || /(^|\s)next(\s|$)/i.test(element.className || '');
  });
  const disabled = !next || next.matches('[disabled], .disabled')
    || /(^|\s)disabled(\s|$)/.test(next?.className || '');
  return {
    current,
    max: numeric.length ? Math.max(...numeric) : current,
    next_url: disabled ? '' : (next.href || ''),
    can_click_next: Boolean(next && !disabled && !next.href),
  };
}

function clickNextPage() {
  const elements = Array.from(document.querySelectorAll(
    '.options-pages a, .options-pages button, .pagination a, .pagination button, '
    + '[class*="pagination"] a, [class*="pagination"] button'
  ));
  const next = elements.find(element => {
    const label = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`;
    return /下一页|next/i.test(label) || /(^|\s)next(\s|$)/i.test(element.className || '');
  });
  if (!next || next.matches('[disabled], .disabled')) return false;
  next.click();
  return true;
}

function expandDetail() {
  const element = Array.from(document.querySelectorAll('button, a, span, div'))
    .find(node => node.children.length === 0 && node.textContent.trim() === '展开全部');
  if (element) element.click();
  return Boolean(element);
}

function extractDetail(cityName) {
  const decode = value => String(value || '').replace(/[\uE031-\uE03A]/g,
    char => String(char.charCodeAt(0) - 0xE031));
  const nodeText = node => decode(node?.innerText || node?.textContent).trim();
  const pick = selector => nodeText(document.querySelector(selector));
  const pageText = nodeText(document.body);
  const loginVisible = Array.from(document.querySelectorAll(
    '.login-dialog, .login-box, .sign-form, [class*="login-dialog"], [class*="login-form"]'
  )).some(node => node.getClientRects().length);
  const needsLogin = loginVisible || /登录(?:后)?查看完整内容|登录可见|登录后可见/.test(pageText);
  const blocked = /环境异常|访问异常|安全验证|请完成验证|验证码/.test(pageText);
  const selectors = [
    '.job-sec-text', '.job-detail-section .job-sec-text',
    '.job-detail .job-sec-text', '.job-detail-section',
  ];
  let jd = '';
  for (const selector of selectors) {
    jd = pick(selector);
    if (jd) break;
  }
  const leaves = Array.from(document.querySelectorAll('*'))
    .filter(node => node.children.length === 0).map(nodeText).filter(Boolean);
  const salary = [pick('.salary, .job-salary, [class*="salary"]'), ...leaves]
    .map(value => value.match(/(?:\d{1,3}(?:\.\d+)?-\d{1,3}(?:\.\d+)?K(?:·\d{1,2}薪)?|\d{1,4}-\d{1,4}元\/(?:天|时)|面议)/i)?.[0] || '')
    .find(Boolean) || '';
  return {
    jd_content: jd,
    company: pick('.company-name, [class*="company-name"]') || nodeText(document.querySelector('a[href*="/gongsi/"]')),
    location: pick('.job-area, .job-location, [class*="location-address"]')
      || leaves.find(value => value === cityName || value.startsWith(`${cityName}·`)) || '',
    salary,
    needs_login: needsLogin,
    blocked,
    url: location.href,
  };
}

function coarseMatch(job) {
  return /产品|用户研究|需求分析/i.test(job.title)
    && !/运营/.test(job.title)
    && !/3-5年|5-10年|10年以上|(?:[2-9]|10)\s*年以上/.test(job.experience)
    && !/硕士|博士/.test(job.education);
}

async function progress(task, values) {
  return api(`/runs/${task.run_id}/progress`, {
    method: 'POST',
    body: JSON.stringify({
      run_id: task.run_id,
      city: values.city || '',
      phase: values.phase || '',
      found: values.found || 0,
      complete_jd: values.complete_jd || 0,
      message: values.message || '',
      jobs: values.jobs || [],
    }),
  });
}

async function finish(task, status, complete, message, jobs) {
  return api(`/runs/${task.run_id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ run_id: task.run_id, status, complete, message, jobs }),
  });
}

async function collect(task) {
  collecting = true;
  const jobs = [];
  let complete = true;
  let skipped = 0;
  try {
    const tab = await ensureBossTab();
    let state = await execute(tab.id, inspectPage);
    if (state?.needs_login || state?.blocked) {
      await chrome.tabs.update(tab.id, { active: true });
      await finish(task, state.blocked ? 'needs_verification' : 'needs_login', false,
        state.blocked ? '请在专用 Chrome 完成 BOSS 安全验证后再采集。'
          : '请在专用 Chrome 登录 BOSS 后再采集。', jobs);
      return;
    }

    for (const city of task.cities) {
      await progress(task, { city: city.name, phase: 'list', found: jobs.length,
        complete_jd: jobs.length, jobs, message: `正在打开${city.name}产品岗位列表……` });
      const searchUrl = `https://www.zhipin.com/web/geek/jobs?query=${encodeURIComponent(task.query)}&city=${city.code}&industry=&position=`;
      await navigate(tab.id, searchUrl);
      let loaded = await waitForCards(tab.id, city.name);
      state = loaded.state;
      if (state?.needs_login || state?.blocked) {
        await chrome.tabs.update(tab.id, { active: true });
        await finish(task, state.blocked ? 'needs_verification' : 'needs_login', false,
          `${city.name}采集需要${state.blocked ? '安全验证' : '重新登录'}；已读取岗位会保留。`, jobs);
        return;
      }
      if (!state?.url?.includes('/web/geek/jobs')) {
        complete = false;
        await progress(task, { city: city.name, phase: 'list_failed', found: jobs.length,
          complete_jd: jobs.length, jobs, message: `${city.name}搜索被重定向：${state?.url || '未知页面'}` });
        continue;
      }

      if (!loaded.cards.length) {
        complete = false;
        await progress(task, { city: city.name, phase: 'list_failed', found: jobs.length,
          complete_jd: jobs.length, jobs,
          message: `${city.name}岗位列表已打开，但未读取到岗位卡片；未归档旧岗位。` });
        continue;
      }

      const seen = new Map();
      let pageNumber = 1;
      for (; pageNumber <= 20; pageNumber += 1) {
        let stableRounds = 0;
        for (let round = 1; round <= 12 && stableRounds < 2; round += 1) {
          const cards = round === 1 && loaded.cards.length
            ? loaded.cards : await execute(tab.id, extractCards, [city.name]) || [];
          const before = seen.size;
          for (const job of cards) seen.set(job.source_url, job);
          stableRounds = seen.size === before ? stableRounds + 1 : 0;
          await progress(task, { city: city.name, phase: 'list', found: jobs.length + seen.size,
            complete_jd: jobs.length, jobs,
            message: `${city.name}第 ${pageNumber} 页，已发现 ${seen.size} 个可见岗位` });
          await execute(tab.id, scrollList);
          await delay(1100 + Math.floor(Math.random() * 500));
        }

        const page = await execute(tab.id, paginationInfo);
        if (!page || (!page.next_url && !page.can_click_next) || page.current >= page.max) break;
        if (page.next_url) {
          await navigate(tab.id, page.next_url);
        } else {
          const oldUrl = (await chrome.tabs.get(tab.id)).url;
          const clicked = await execute(tab.id, clickNextPage);
          if (!clicked) break;
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline) {
            await delay(400);
            const currentTab = await chrome.tabs.get(tab.id);
            if (currentTab.url !== oldUrl || currentTab.status === 'loading') break;
          }
          await waitForTab(tab.id);
        }
        loaded = await waitForCards(tab.id, city.name);
        state = loaded.state;
        if (state?.needs_login || state?.blocked) {
          await chrome.tabs.update(tab.id, { active: true });
          await finish(task, state.blocked ? 'needs_verification' : 'needs_login', false,
            `${city.name}翻页时需要${state.blocked ? '安全验证' : '重新登录'}；已读取岗位会保留。`, jobs);
          return;
        }
        if (!loaded.cards.length) {
          complete = false;
          skipped += 1;
          break;
        }
      }
      if (pageNumber > 20) {
        complete = false;
        await progress(task, { city: city.name, phase: 'list_limit', found: jobs.length + seen.size,
          complete_jd: jobs.length, jobs, message: `${city.name}岗位超过 20 页，本次未视为完整扫描。` });
      }

      const candidates = Array.from(seen.values()).filter(coarseMatch);
      for (let index = 0; index < candidates.length; index += 1) {
        const job = candidates[index];
        await navigate(tab.id, job.source_url);
        state = await execute(tab.id, inspectPage);
        if (state?.needs_login || state?.blocked) {
          await chrome.tabs.update(tab.id, { active: true });
          await finish(task, state.blocked ? 'needs_verification' : 'needs_login', false,
            `读取${city.name}岗位详情时需要${state.blocked ? '安全验证' : '重新登录'}；已读取岗位会保留。`, jobs);
          return;
        }
        await execute(tab.id, expandDetail);
        await delay(250);
        const detail = await execute(tab.id, extractDetail, [city.name]);
        if (detail?.needs_login || detail?.blocked) {
          await chrome.tabs.update(tab.id, { active: true });
          await finish(task, detail.blocked ? 'needs_verification' : 'needs_login', false,
            '详情页需要登录或安全验证；已保留当前页面。', jobs);
          return;
        }
        if (!detail?.jd_content || /登录(?:后)?查看完整内容|登录可见|登录后可见/.test(detail.jd_content)) {
          skipped += 1;
          complete = false;
          continue;
        }
        jobs.push({
          ...job,
          jd_content: detail.jd_content,
          company: job.company || detail.company || '',
          location: job.location || detail.location || '',
          salary: job.salary || detail.salary || '',
        });
        if (jobs.length % 5 === 0 || index === candidates.length - 1) {
          await progress(task, { city: city.name, phase: 'detail', found: jobs.length,
            complete_jd: jobs.length, jobs,
            message: `正在读取${city.name}岗位详情（${index + 1}/${candidates.length}）` });
        }
        await delay(700 + Math.floor(Math.random() * 500));
      }
    }

    const successful = complete && skipped === 0 && jobs.length > 0;
    await finish(task, successful ? 'success' : jobs.length ? 'partial' : 'failed', successful,
      successful ? `采集完成，获取 ${jobs.length} 个含完整 JD 的岗位。`
        : jobs.length ? `部分完成：获取 ${jobs.length} 个岗位，跳过 ${skipped} 个不完整详情，未归档旧岗位。`
          : '本次未获取到含完整 JD 的岗位。', jobs);
  } catch (error) {
    await finish(task, jobs.length ? 'partial' : 'failed', false,
      `采集中断：${String(error.message || error).slice(0, 500)}`, jobs).catch(() => {});
  } finally {
    collecting = false;
  }
}

async function tick() {
  try {
    const tabs = await bossTabs();
    const tab = tabs.find(item => item.active) || tabs[0];
    let page = null;
    if (tab) page = await execute(tab.id, inspectPage).catch(() => null);
    await api('/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        version: VERSION,
        logged_in: Boolean(page?.logged_in && !page.needs_login && !page.blocked),
        current_url: page?.url || '',
        state: collecting ? 'collecting' : page?.blocked ? 'needs_verification' : 'idle',
      }),
    });
    if (!collecting && !claiming) {
      claiming = true;
      try {
        const response = await api('/tasks/next');
        if (response.task) await collect(response.task);
      } finally {
        claiming = false;
      }
    }
  } catch (_) {
    collectorToken = '';
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('agent-poll', { periodInMinutes: 0.5 });
  tick();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('agent-poll', { periodInMinutes: 0.5 });
  tick();
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'agent-poll') tick();
});
setInterval(tick, 10000);
tick();
