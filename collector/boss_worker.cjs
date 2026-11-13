/* Browser worker. stdout is reserved for one final JSON result. */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'playwright'),
    '/Users/jiangnannan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
    'playwright',
  ];
  for (const candidate of candidates) { try { return require(candidate); } catch (_) {} }
  throw new Error('未找到 Playwright。请运行 npm install。');
}
const { chromium } = loadPlaywright();
const config = JSON.parse(process.argv[2] || '{}');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = data => { try { fs.writeFileSync(config.progress, JSON.stringify(data)); } catch (_) {} };
const decodeBossText = value => String(value || '').replace(/[\uE031-\uE03A]/g,
  char => String(char.charCodeAt(0) - 0xE031));
const salaryFromText = value => {
  const match = decodeBossText(value).match(/(?:\d{1,3}(?:\.\d+)?-\d{1,3}(?:\.\d+)?K(?:·\d{1,2}薪)?|\d{1,4}-\d{1,4}元\/(?:天|时)|面议)/i);
  return match?.[0] || '';
};
const incompleteDetail = value => /登录(?:后)?查看完整内容|登录可见|登录后可见/.test(String(value || ''));
const blockedPage = value => /环境异常|访问异常|安全验证|请完成验证|验证码/.test(String(value || ''));

async function bodyText(page) {
  return page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
}

async function requiresLogin(page, text = '') {
  if (/\/(?:login|web\/user)(?:[/?#]|$)/i.test(page.url())) return true;
  const selectors = [
    '.login-dialog', '.login-box', '.sign-form', '[class*="login-dialog"]',
    'form[action*="login"]', '[class*="login-form"]',
  ];
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
  }
  return /扫码登录|手机号登录|密码登录|请先登录/.test(text)
    && !/职位描述|职位详情|岗位职责|职位要求/.test(text);
}

async function retryNavigation(action, page, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      return await action();
    } catch (error) {
      lastError = error;
      const transient = /Execution context was destroyed|navigation|Target page, context or browser has been closed/i.test(error.message || '');
      if (!transient || attempt === attempts) throw error;
      await sleep(700 * attempt);
    }
  }
  throw lastError;
}

async function cardData(page, city) {
  const locator = page.locator('.job-card-wrapper, .job-card-box');
  const rows = await locator.evaluateAll((cards, cityName) => cards.map(card => {
    // BOSS commonly represents salary digits as U+E031..U+E03A with a webfont.
    const decode = value => String(value || '').replace(/[\uE031-\uE03A]/g, char => String(char.charCodeAt(0) - 0xE031));
    const nodeText = node => decode(node?.innerText || node?.textContent).trim();
    const text = selector => nodeText(card.querySelector(selector));
    const leaves = Array.from(card.querySelectorAll('*')).filter(node => node.children.length === 0)
      .map(node => nodeText(node)).filter(Boolean);
    const list = Array.from(card.querySelectorAll('.job-info li, .tag-list li, .job-card-footer .tag-list li')).map(nodeText).filter(Boolean);
    const anchor = card.querySelector('a[href*="job_detail"]');
    const href = anchor?.href || '';
    const area = text('.job-area, .job-location, [class*="area"]') || leaves.find(x => x === cityName || x.startsWith(cityName + '·')) || '';
    const company = text('.company-name, [class*="company-name"]')
      || nodeText(card.querySelector('a[href*="/gongsi/"]'));
    const salaryPattern = /(?:\d{1,3}(?:\.\d+)?-\d{1,3}(?:\.\d+)?K(?:·\d{1,2}薪)?|\d{1,4}-\d{1,4}元\/(?:天|时)|面议)/i;
    const salaryCandidates = [text('.salary, .job-salary, [class*="salary"]'), ...leaves,
      ...decode(card.innerText || card.textContent).split(/\n+/).map(x => x.trim())];
    const salary = salaryCandidates.map(x => x.match(salaryPattern)?.[0] || '').find(Boolean) || '';
    return { title: text('.job-name'), company, location: area,
      salary, source_url: href, experience: list.find(x => /经验|应届|年|不限/.test(x)) || '',
      education: list.find(x => /学历不限|大专|本科|硕士|博士/.test(x)) || '', tags: list, city: cityName };
  }), city);
  // Some BOSS salary digits are exposed only through the accessibility tree.
  // ariaSnapshot sees the rendered private-use glyphs; decode them as a fallback.
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].salary) continue;
    const snapshot = await locator.nth(index).ariaSnapshot({ timeout: 2000 }).catch(() => '');
    rows[index].salary = salaryFromText(snapshot);
  }
  return rows;
}

async function stableCardData(page, city) {
  return retryNavigation(async () => {
    await page.locator('.job-card-wrapper, .job-card-box').first().waitFor({ state: 'visible', timeout: 10000 });
    return cardData(page, city);
  }, page, 2);
}

async function openCitySearch(page, city) {
  const citySlugs = { '杭州': 'hangzhou', '宁波': 'ningbo', '上海': 'shanghai' };
  const slug = citySlugs[city.name];
  if (!slug) throw new Error(`未配置城市首页：${city.name}`);
  await page.goto(`https://www.zhipin.com/${slug}/?seoRefer=index`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  const input = page.locator(
    'input[placeholder*="搜索职位"], input[placeholder*="职位、公司"], input[name="query"]'
  ).first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill('产品');
  const button = page.locator(
    'button:has-text("搜索"), .search-btn, [class*="search-btn"]'
  ).first();
  const waitForResults = page.waitForURL(url =>
    url.pathname.includes('/web/geek/jobs') && url.searchParams.get('query') === '产品',
  { timeout: 20000 }).catch(() => {});
  if (await button.isVisible().catch(() => false)) await button.click();
  else await input.press('Enter');
  await waitForResults;
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.locator('.job-card-wrapper, .job-card-box').first().waitFor({
    state: 'visible', timeout: 20000,
  });
}

async function detailData(detail, url, city) {
  try {
    await detail.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(500);
    const pageText = await bodyText(detail);
    if (blockedPage(pageText) || await requiresLogin(detail, pageText)) return { needsLogin: true, text: '' };
    if (incompleteDetail(pageText)) return { needsLogin: true, text: '' };
    const expand = detail.getByText('展开全部', { exact: true }).first();
    if (await expand.isVisible().catch(() => false)) {
      await expand.click({ timeout: 3000 }).catch(() => {});
      await sleep(250);
    }
    const facts = await detail.locator('body').evaluate((body, cityName) => {
      const decode = value => String(value || '').replace(/[\uE031-\uE03A]/g, char => String(char.charCodeAt(0) - 0xE031));
      const nodeText = node => decode(node?.innerText || node?.textContent).trim();
      const pick = selector => nodeText(body.querySelector(selector));
      const leaves = Array.from(body.querySelectorAll('*')).filter(node => node.children.length === 0)
        .map(node => nodeText(node)).filter(Boolean);
      const salaryPattern = /(?:\d{1,3}(?:\.\d+)?-\d{1,3}(?:\.\d+)?K(?:·\d{1,2}薪)?|\d{1,4}-\d{1,4}元\/(?:天|时)|面议)/i;
      const salaryCandidates = [pick('.salary, .job-salary, [class*="salary"]'), ...leaves,
        ...decode(body.innerText || body.textContent).split(/\n+/).map(x => x.trim())];
      return {
        company: pick('.company-name, [class*="company-name"]') || nodeText(body.querySelector('a[href*="/gongsi/"]')),
        location: pick('.job-area, .job-location, [class*="location-address"]') || leaves.find(x => x === cityName || x.startsWith(cityName + '·')) || '',
        salary: salaryCandidates.map(x => x.match(salaryPattern)?.[0] || '').find(Boolean) || '',
      };
    }, city);
    const selectors = ['.job-sec-text', '.job-detail-section .job-sec-text', '.job-detail .job-sec-text', '.job-detail-section'];
    for (const selector of selectors) {
      const node = detail.locator(selector).first();
      if (await node.count()) {
        const text = (await node.innerText()).trim();
        if (incompleteDetail(text)) return { needsLogin: true, text: '', ...facts };
        if (text) return { needsLogin: false, text, ...facts };
      }
    }
    return { needsLogin: false, text: '', error: '详情页未找到岗位职责区域', ...facts };
  } catch (error) {
    return { needsLogin: false, text: '', error: String(error.message || error).split('\n')[0] };
  }
}

async function main() {
  let browser; let context;
  try {
    browser = await chromium.connectOverCDP(config.cdp_url || 'http://127.0.0.1:9333');
    context = browser.contexts()[0];
    if (!context) throw new Error('专用 Chrome 中没有可用会话');
  } catch (error) {
    throw new Error(`无法连接 BOSS 专用 Chrome：${String(error.message || error).split('\n')[0]}`);
  }
  const page = context.pages().find(candidate =>
    !candidate.isClosed() && /(?:^|\.)zhipin\.com/i.test(new URL(candidate.url()).hostname)
  );
  if (!page) {
    throw new Error('未找到已打开的 BOSS 标签页。请在专用 Chrome 中打开 BOSS 首页并保持该页打开。');
  }
  const jobs = []; const failures = []; let complete = true; let skippedDetails = 0;
  try {
    for (const city of config.cities) {
      const seen = new Map(); let stableRounds = 0;
      report({ run_id: config.run_id, city: city.name, page: 1, found: jobs.length, jobs,
        message: `正在打开${city.name}岗位列表` });
      try {
        await openCitySearch(page, city);
      } catch (_) {
        const body = await page.locator('body').innerText().catch(() => '');
        if (await requiresLogin(page, body) || blockedPage(body)) {
          await page.bringToFront().catch(() => {});
          console.log(JSON.stringify({ status: 'needs_login', complete: false, jobs,
            message: 'BOSS 要求登录或安全验证。需要操作的页面已保留；完成后保持 Chrome 打开并再次采集。' }));
          return;
        } else {
          complete = false;
          failures.push(`${city.name}搜索停留在 ${page.url()}`);
          report({ run_id: config.run_id, city: city.name, page: 1, found: jobs.length, jobs,
            message: `${city.name}搜索未进入岗位列表（当前页：${page.url()}）` });
          continue;
        }
      }
      // BOSS loads more cards while the result page is scrolled. Stop after two
      // stable rounds; this represents everything viewable in this browser run.
      for (let round = 1; round <= 12 && stableRounds < 2; round++) {
        let cards;
        try {
          cards = await stableCardData(page, city.name);
        } catch (error) {
          complete = false;
          report({ run_id: config.run_id, city: city.name, page: round, found: jobs.length, jobs,
            message: `${city.name}列表在滚动后未继续加载，已保留当前发现的 ${seen.size} 条` });
          break;
        }
        const before = seen.size;
        for (const card of cards) if (card.source_url) seen.set(card.source_url, card);
        stableRounds = seen.size === before ? stableRounds + 1 : 0;
        report({ run_id: config.run_id, city: city.name, page: round, found: jobs.length, jobs,
          message: `正在读取${city.name}可见岗位（已发现 ${seen.size} 条）` });
        await retryNavigation(() => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)), page);
        await sleep(1100 + Math.floor(Math.random() * 500));
      }
      const candidates = Array.from(seen.values()).filter(job =>
        /产品|用户研究|需求分析/i.test(job.title)
        && !/运营/.test(job.title)
        && !/3-5年|5-10年|10年以上|(?:[2-9]|10)\s*年以上/.test(job.experience)
        && !/硕士|博士/.test(job.education));
      for (const job of candidates) {
        let result = await detailData(page, job.source_url, city.name);
        if (result.needsLogin) {
          await page.bringToFront().catch(() => {});
          console.log(JSON.stringify({ status: 'needs_login', complete: false, jobs,
            message: 'BOSS 详情页要求登录或安全验证。该页面已保留；完成后再采集，已读取岗位会保留。' }));
          return;
        }
        if (!result.text || incompleteDetail(result.text)) {
          // Retry transient navigation/layout failures. Never persist a card-only
          // record as if it contained a complete JD.
          for (let attempt = 1; attempt <= 2 && !result.text; attempt++) {
            await sleep(700 * attempt);
            result = await detailData(page, job.source_url, city.name);
          }
        }
        if (!result.text || incompleteDetail(result.text) || result.needsLogin) {
          skippedDetails += 1;
          complete = false;
          report({ run_id: config.run_id, city: city.name, page: 1, found: jobs.length, jobs,
            message: `跳过 1 个未获取完整 JD 的岗位（累计 ${skippedDetails} 个）` });
          continue;
        }
        job.jd_content = result.text;
        job.company = job.company || result.company || '';
        job.location = job.location || result.location || '';
        job.salary = job.salary || result.salary || '';
        jobs.push(job);
        report({ run_id: config.run_id, city: city.name, page: 1, found: jobs.length, jobs,
          message: `正在读取${city.name}岗位详情（${jobs.length}）` });
        await sleep(700 + Math.floor(Math.random() * 500));
      }
    }
    const status = jobs.length ? (complete ? 'success' : 'partial') : 'failed';
    console.log(JSON.stringify({ status, complete: complete && jobs.length > 0, jobs,
      skipped_details: skippedDetails,
      message: jobs.length === 0 ? `本次未读取到任何完整岗位。${failures.join('；') || '请查看专用 Chrome 当前停留页面。'}`
        : complete ? '杭州、宁波、上海当前可见岗位扫描完成。'
        : `本次只完成部分扫描；跳过 ${skippedDetails} 个未获取完整 JD 的岗位，未自动归档旧岗位。` }));
  } finally {
    // Reuse the user's existing BOSS page and leave it open at every exit.
    // The forced Node exit below only drops CDP; it does not close Chrome.
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
