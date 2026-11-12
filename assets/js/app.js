/* =========================================================
   SalaryDeck · 应用逻辑
   数据结构 → 计算模型 → 渲染卡片 / SVG 图表 / 编辑抽屉
   ========================================================= */
(function () {
  'use strict';

  const STORE_KEY = 'salarydeck.v2';
  const SEED = window.SALARY_SEED;
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  /* ---------------- 工具 ---------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const nf = new Intl.NumberFormat('zh-CN');
  const money = (n) => '¥' + nf.format(Math.round(n));
  const plain = (n) => nf.format(Math.round(n));

  function shortMoney(n) {
    const abs = Math.abs(n);
    if (abs >= 10000) {
      const v = n / 10000;
      return (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + '万';
    }
    if (abs >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function niceMax(value) {
    if (value <= 0) return 1000;
    const exp = Math.pow(10, Math.floor(Math.log10(value)));
    const f = value / exp;
    const nice = f <= 1 ? 1 : f <= 1.2 ? 1.2 : f <= 1.5 ? 1.5 : f <= 2 ? 2
      : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return nice * exp;
  }

  function smoothPath(pts, tension) {
    const t = tension === undefined ? 0.18 : tension;
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t;
      const c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t;
      const c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d;
  }

  function barPath(x, y, w, h, r, roundTop) {
    if (h <= 0.2) return '';
    r = Math.min(r, w / 2, h);
    if (!roundTop) return `M${x},${y}h${w}v${h}h${-w}Z`;
    return `M${x},${y + r}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}h${-w}Z`;
  }

  function mixViolet(ratio) {
    const r = clamp(ratio, 0, 1);
    const from = [243, 238, 255];
    const to = [109, 74, 255];
    const c = from.map((v, i) => Math.round(v + (to[i] - v) * Math.pow(r, 0.82)));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function animateNumber(el, target, duration) {
    const dur = duration || 900;
    if (!el) return;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = plain(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = plain(from + (target - from) * eased);
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  /* ---------------- 图标 ---------------- */
  const ICONS = {
    edit: '<path d="M12 20h9"/><path d="M16.6 3.4a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    reset: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="m18.5 15.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    flame: '<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.6-2.8 1.7-4 .2 1.6 1 2.5 2 2.8C11.2 8.6 11.5 6 12 3Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M16.5 15h1.5"/>'
  };

  function icon(name, cls) {
    const body = ICONS[name] || '';
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function hydrateIcons(root) {
    $$('[data-icon]', root || document).forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
      el.removeAttribute('data-icon');
    });
  }

  /* ---------------- 状态 ---------------- */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalize(data) {
    const out = clone(data);
    out.settings = out.settings || {};
    out.settings.targets = out.settings.targets || {};
    out.settings.updateDate = out.settings.updateDate || '';
    out.years = out.years || {};
    Object.keys(out.years).forEach((y) => {
      const rows = out.years[y] || [];
      const map = new Map(rows.map((r) => [Number(r.m), r]));
      out.years[y] = MONTHS.map((m) => {
        const r = map.get(m) || {};
        return {
          m,
          base: num(r.base),
          perf: num(r.perf),
          subsidy: num(r.subsidy),
          bonus: num(r.bonus),
          part: num(r.part),
          note: typeof r.note === 'string' ? r.note : ''
        };
      });
    });
    return out;
  }

  function loadState() {
    try {
      localStorage.removeItem('salarydeck.v1');
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.years) return normalize(parsed);
      }
    } catch (err) {
      console.warn('[SalaryDeck] 本地数据读取失败，已回退到示例数据。', err);
    }
    return normalize(SEED);
  }

  let state = loadState();
  let activeYear = pickInitialYear();
  let model = null;

  function pickInitialYear() {
    const years = Object.keys(state.years).sort();
    if (!years.length) return String(new Date().getFullYear());
    const current = String(new Date().getFullYear());
    if (state.years[current]) return current;
    return years[years.length - 1];
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn('[SalaryDeck] 保存失败', err);
      return false;
    }
  }

  function today() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /* ---------------- 计算模型 ---------------- */
  function buildModel(year) {
    const rows = state.years[year] || [];
    const months = MONTHS.map((m) => {
      const r = rows.find((x) => x.m === m) || {};
      const base = num(r.base);
      const perf = num(r.perf);
      const subsidy = num(r.subsidy);
      const bonus = num(r.bonus);
      const part = num(r.part);
      const main = base + perf + subsidy + bonus;
      return {
        m,
        base, perf, subsidy, bonus, part,
        note: r.note || '',
        main,
        total: main + part
      };
    });

    const active = months.filter((r) => r.total > 0);
    const lastActive = active.length ? active[active.length - 1].m : 0;

    const sum = (key) => active.reduce((acc, r) => acc + r[key], 0);
    const main = sum('main');
    const part = sum('part');
    const total = main + part;

    const best = active.reduce((a, b) => (b.total > a.total ? b : a), active[0] || months[0]);
    const bestPart = active.reduce((a, b) => (b.part > a.part ? b : a), active[0] || months[0]);
    const avg = active.length ? total / active.length : 0;

    const target = num(state.settings.targets[year]);
    const progress = target > 0 ? total / target : 0;

    const prevYear = String(Number(year) - 1);
    const prevRows = state.years[prevYear] || [];
    const prevTotal = prevRows
      .filter((r) => r.m <= lastActive)
      .reduce((acc, r) => acc + num(r.base) + num(r.perf) + num(r.subsidy) + num(r.bonus) + num(r.part), 0);

    return {
      year,
      months,
      active,
      lastActive,
      main,
      part,
      total,
      avg,
      target,
      progress,
      best,
      bestPart,
      streak: longestStreak(active),
      breakdown: {
        base: sum('base'),
        perf: sum('perf'),
        subsidy: sum('subsidy'),
        bonus: sum('bonus')
      },
      prevTotal,
      yoy: prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
      hasPrev: prevTotal > 0,
      count: active.length
    };
  }

  function longestStreak(active) {
    let best = 0;
    let cur = 1;
    if (active.length < 2) return active.length;
    for (let i = 1; i < active.length; i++) {
      if (active[i].total > active[i - 1].total) {
        cur += 1;
        best = Math.max(best, cur);
      } else {
        cur = 1;
      }
    }
    return best;
  }

  /* ---------------- 渲染：顶部 ---------------- */
  function renderYearSwitch() {
    const host = $('#yearSwitch');
    const years = Object.keys(state.years).sort();
    host.innerHTML = years
      .map(
        (y) =>
          `<button type="button" role="tab" data-year="${y}" class="${y === activeYear ? 'active' : ''}" aria-selected="${y === activeYear}">${y}</button>`
      )
      .join('');
  }

  function renderHero(m) {
    $('#heroEyebrow').textContent = `${m.year} · 年度总览`;
    const host = $('#heroValue');
    const target = Math.round(m.total);
    const existing = $('.num', host);
    if (existing) {
      animateNumber(existing, target);
    } else {
      host.innerHTML = `<span class="cur">¥</span><span class="num">${plain(0)}</span>`;
      animateNumber($('.num', host), target);
    }

    const yoyEl = $('#heroYoy');
    if (m.yoy === null) {
      yoyEl.hidden = true;
    } else {
      yoyEl.hidden = false;
      const up = m.yoy >= 0;
      yoyEl.className = `pill ${up ? 'pill-up' : 'pill-down'}`;
      yoyEl.textContent = `${up ? '↑' : '↓'} 同比 ${up ? '+' : ''}${(m.yoy * 100).toFixed(1)}%`;
    }

    $('#heroMonths').textContent = `已录入 ${m.count} / 12 个月`;
    const cta = $('#heroCta');
    if (cta) cta.hidden = m.count > 0;
    if (m.count === 0) {
      $('#heroUpdated').textContent = '等待录入';
      $('#footMeta').textContent = '尚未录入数据';
    } else {
      const date = state.settings.updateDate || today();
      $('#heroUpdated').textContent = `更新于 ${date}`;
      $('#footMeta').textContent = `${m.count} 个月数据 · 最近更新 ${date}`;
    }

    const mainPct = m.total > 0 ? m.main / m.total : 0;
    const partPct = m.total > 0 ? m.part / m.total : 0;
    $('#heroSplit').innerHTML = `
      <div class="split">
        <div class="split-top">
          <span class="split-name"><i style="background:#6D4AFF"></i>主业收入</span>
          <span class="split-amt">${money(m.main)}<em>${(mainPct * 100).toFixed(1)}%</em></span>
        </div>
        <div class="split-track"><span data-w="${mainPct * 100}" style="background:linear-gradient(90deg,#9C86FF,#5B37EC)"></span></div>
      </div>
      <div class="split">
        <div class="split-top">
          <span class="split-name"><i style="background:#FF7A59"></i>兼职收入</span>
          <span class="split-amt">${money(m.part)}<em>${(partPct * 100).toFixed(1)}%</em></span>
        </div>
        <div class="split-track"><span data-w="${partPct * 100}" style="background:linear-gradient(90deg,#FFB49C,#FF7A59)"></span></div>
      </div>`;
    requestAnimationFrame(() => {
      $$('#heroSplit .split-track span').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    });
  }

  function renderKpis(m) {
    const avgEl = $('#kpiAvg');
    avgEl.textContent = m.count ? money(m.avg) : '—';
    $('#kpiAvgSub').textContent = m.count ? `按 ${m.count} 个月计算` : '暂无数据';

    $('#kpiBest').textContent = m.count ? money(m.best.total) : '—';
    $('#kpiBestSub').textContent = m.count
      ? `${m.best.m} 月 · ${m.best.bonus > 0 ? '含年终奖' : '主业 + 兼职'}`
      : '暂无数据';

    $('#kpiPart').textContent = money(m.part);
    $('#kpiPartSub').textContent = m.total > 0
      ? `占总收入 ${((m.part / m.total) * 100).toFixed(1)}%`
      : '暂无数据';
  }

  /* ---------------- 渲染：迷你趋势 ---------------- */
  function renderSpark(m) {
    const host = $('#heroSpark');
    if (!host || host.clientWidth < 40) return;
    const W = host.clientWidth;
    const H = host.clientHeight || 120;
    if (!m.count) {
      host.innerHTML = `<span class="spark-cap">月度走势</span>
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
          <line x1="8" y1="${H - 16}" x2="${W - 8}" y2="${H - 16}" stroke="rgba(109,74,255,.2)" stroke-dasharray="4 5"/>
          <circle cx="${W - 8}" cy="${H - 16}" r="3" fill="#fff" stroke="rgba(109,74,255,.35)" stroke-width="1.6"/>
        </svg>`;
      return;
    }
    const data = m.active.length ? m.active : m.months;
    const vals = data.map((d) => d.total);
    const max = Math.max.apply(null, vals.concat([1])) * 1.18;
    const pad = { l: 8, r: 8, t: 28, b: 8 };
    const x = (i) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
    const y = (v) => H - pad.b - (v / max) * (H - pad.b - pad.t);
    const pts = data.map((d, i) => [x(i), y(d.total)]);
    const line = smoothPath(pts, 0.2);
    const area = `${line} L${x(data.length - 1).toFixed(2)},${H - pad.b} L${x(0).toFixed(2)},${H - pad.b} Z`;
    const last = pts[pts.length - 1];

    host.innerHTML = `
      <span class="spark-cap">月度走势</span>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
        <defs>
          <linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6D4AFF" stop-opacity="0.30"/>
            <stop offset="100%" stop-color="#6D4AFF" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="gSparkLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#B3A0FF"/>
            <stop offset="100%" stop-color="#5B37EC"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#gSpark)"/>
        <path d="${line}" fill="none" stroke="url(#gSparkLine)" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="#fff" stroke="#6D4AFF" stroke-width="2.4"/>
      </svg>`;
  }

  function emptyChart(host, text) {
    if (!host) return;
    host.innerHTML = `<div class="chart-empty"><span class="empty-ico">${icon('sparkle')}</span><span>${text}</span></div>`;
  }

  /* ---------------- 渲染：全年趋势 ---------------- */
  function renderTrend(m) {
    const host = $('#trendChart');
    if (!host || host.clientWidth < 40) return;
    if (!m.count) {
      emptyChart(host, '录入第一个月后，这里会自动生成走势');
      return;
    }
    const W = host.clientWidth;
    const H = 268;
    const pad = { l: 50, r: 16, t: 20, b: 30 };
    const data = m.active;
    const max = niceMax(Math.max.apply(null, data.map((d) => d.total).concat([1])) * 1.12);
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const x = (month) => pad.l + ((month - 1) / 11) * innerW;
    const y = (v) => pad.t + (1 - v / max) * innerH;

    const pts = data.map((d) => [x(d.m), y(d.total)]);
    const line = smoothPath(pts);
    const area = pts.length > 1
      ? `${line} L${pts[pts.length - 1][0].toFixed(2)},${pad.t + innerH} L${pts[0][0].toFixed(2)},${pad.t + innerH} Z`
      : '';

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      const gy = y(v);
      grid += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="rgba(109,74,255,0.09)" stroke-dasharray="${i === 0 ? '0' : '3 5'}"/>`;
      grid += `<text x="${pad.l - 9}" y="${gy + 3.5}" text-anchor="end" font-size="9.5" fill="#B3ADC0">${shortMoney(v)}</text>`;
    }

    const labelStep = Math.ceil(12 / Math.max(1, Math.floor(innerW / 44)));
    let xLabels = '';
    for (let mo = 1; mo <= 12; mo++) {
      if ((mo - 1) % labelStep !== 0 && mo !== 12) continue;
      xLabels += `<text x="${x(mo)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#B3ADC0">${mo}月</text>`;
    }

    const dots = pts
      .map(
        (p, i) =>
          `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${i === pts.length - 1 ? 4 : 2.8}" fill="#fff" stroke="#6D4AFF" stroke-width="${i === pts.length - 1 ? 2.4 : 1.8}"/>`
      )
      .join('');

    const avg = m.avg;
    const avgLine = m.count > 1 && avg > 0 && avg < max
      ? `<line x1="${pad.l}" y1="${y(avg)}" x2="${W - pad.r}" y2="${y(avg)}" stroke="rgba(18,185,140,0.55)" stroke-dasharray="5 5" stroke-width="1.2"/>
         <text x="${W - pad.r}" y="${y(avg) - 7}" text-anchor="end" font-size="9.5" fill="#12A981">月均 ${money(avg)}</text>`
      : '';

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="全年收入走势">
        <defs>
          <linearGradient id="gTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6D4AFF" stop-opacity="0.26"/>
            <stop offset="72%" stop-color="#6D4AFF" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="#6D4AFF" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="gTrendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#9C86FF"/>
            <stop offset="55%" stop-color="#6D4AFF"/>
            <stop offset="100%" stop-color="#5433E2"/>
          </linearGradient>
          <filter id="fTrend" x="-20%" y="-30%" width="140%" height="170%">
            <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#6D4AFF" flood-opacity="0.22"/>
          </filter>
        </defs>
        ${grid}
        ${area ? `<path d="${area}" fill="url(#gTrend)"/>` : ''}
        ${line ? `<path d="${line}" fill="none" stroke="url(#gTrendLine)" stroke-width="2.6" stroke-linecap="round" filter="url(#fTrend)"/>` : ''}
        ${avgLine}
        ${dots}
        ${xLabels}
        <rect x="${pad.l}" y="${pad.t}" width="${innerW}" height="${innerH}" fill="transparent" class="hover-zone"/>
      </svg>`;

    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);

    const svg = $('svg', host);
    svg.addEventListener('mousemove', (ev) => {
      const rect = svg.getBoundingClientRect();
      const mx = ((ev.clientX - rect.left) / rect.width) * W;
      let idx = 0;
      let best = Infinity;
      data.forEach((d, i) => {
        const dx = Math.abs(x(d.m) - mx);
        if (dx < best) {
          best = dx;
          idx = i;
        }
      });
      if (best > 34) {
        tip.classList.remove('show');
        return;
      }
      const d = data[idx];
      tip.innerHTML = `
        <div class="tip-m">${m.year} 年 ${d.m} 月</div>
        <div class="tip-v">${money(d.total)}</div>
        <div class="tip-row"><i style="background:#6D4AFF"></i>主业<b>${money(d.main)}</b></div>
        <div class="tip-row"><i style="background:#FF7A59"></i>兼职<b>${money(d.part)}</b></div>`;
      tip.classList.add('show');
      const px = clamp(x(d.m), tip.offsetWidth / 2 + 4, host.clientWidth - tip.offsetWidth / 2 - 4);
      tip.style.left = px + 'px';
      tip.style.top = Math.max(y(d.total) - 4, tip.offsetHeight + 6) + 'px';
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
  }

  /* ---------------- 渲染：堆叠柱 ---------------- */
  function renderStack(m) {
    const host = $('#stackChart');
    if (!host || host.clientWidth < 40) return;
    if (!m.count) {
      $('#stackLegend').innerHTML = '';
      emptyChart(host, '录入数据后生成主业与兼职的月度对比');
      return;
    }
    const W = host.clientWidth;
    const H = 236;
    const pad = { l: 48, r: 12, t: 16, b: 26 };
    const data = m.active;

    $('#stackLegend').innerHTML = `
      <li class="legend-item"><i style="background:linear-gradient(145deg,#8B6CFF,#5B37EC)"></i><span class="legend-name">主业</span><span class="legend-val">${money(m.main)}</span></li>
      <li class="legend-item"><i style="background:linear-gradient(145deg,#FFA184,#FF7048)"></i><span class="legend-name">兼职</span><span class="legend-val">${money(m.part)}</span></li>`;

    const max = niceMax(Math.max.apply(null, data.map((d) => d.total).concat([1])) * 1.1);
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const slot = innerW / 12;
    const bw = Math.min(26, slot * 0.56);
    const cxOf = (month) => pad.l + slot * (month - 0.5);
    const y = (v) => pad.t + (1 - v / max) * innerH;

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      const gy = y(v);
      grid += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="rgba(109,74,255,0.09)" stroke-dasharray="${i === 0 ? '0' : '3 5'}"/>`;
      grid += `<text x="${pad.l - 9}" y="${gy + 3.5}" text-anchor="end" font-size="9.5" fill="#B3ADC0">${shortMoney(v)}</text>`;
    }

    const labelStep = Math.ceil(12 / Math.max(1, Math.floor(innerW / 40)));
    let bars = '';
    let labels = '';
    for (let mo = 1; mo <= 12; mo++) {
      if ((mo - 1) % labelStep !== 0 && mo !== 12) continue;
      labels += `<text x="${cxOf(mo)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#B3ADC0">${mo}月</text>`;
    }
    data.forEach((d, i) => {
      const cx = cxOf(d.m);
      const bx = cx - bw / 2;
      const baseY = pad.t + innerH;
      const mainH = (d.main / max) * innerH;
      const partH = (d.part / max) * innerH;
      const x0 = Number(bx.toFixed(2));
      const w0 = Number(bw.toFixed(2));
      if (mainH > 0) {
        bars += `<path d="${barPath(x0, baseY - mainH, w0, mainH, 6, partH <= 0)}" fill="url(#gStackMain)"/>`;
      }
      if (partH > 0) {
        bars += `<path d="${barPath(x0, baseY - mainH - partH, w0, partH, 6, true)}" fill="url(#gStackPart)"/>`;
      }
      bars += `<rect x="${(cx - slot / 2).toFixed(2)}" y="${pad.t}" width="${slot.toFixed(2)}" height="${innerH}" fill="transparent" data-i="${i}" data-m="${d.m}" class="bar-zone"/>`;
    });

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="主业与兼职月度对比">
        <defs>
          <linearGradient id="gStackMain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8B6CFF"/>
            <stop offset="100%" stop-color="#5B37EC"/>
          </linearGradient>
          <linearGradient id="gStackPart" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFA184"/>
            <stop offset="100%" stop-color="#FF7048"/>
          </linearGradient>
        </defs>
        ${grid}
        ${bars}
        ${labels}
      </svg>`;

    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    const svg = $('svg', host);
    svg.addEventListener('mousemove', (ev) => {
      const zone = ev.target.closest('.bar-zone');
      if (!zone) {
        tip.classList.remove('show');
        return;
      }
      const i = Number(zone.dataset.i);
      const d = data[i];
      const cx = cxOf(d.m);
      tip.innerHTML = `
        <div class="tip-m">${m.year} 年 ${d.m} 月</div>
        <div class="tip-v">${money(d.total)}</div>
        <div class="tip-row"><i style="background:#6D4AFF"></i>主业<b>${money(d.main)}</b></div>
        <div class="tip-row"><i style="background:#FF7A59"></i>兼职<b>${money(d.part)}</b></div>`;
      tip.classList.add('show');
      const px = clamp(cx, tip.offsetWidth / 2 + 4, host.clientWidth - tip.offsetWidth / 2 - 4);
      tip.style.left = px + 'px';
      tip.style.top = Math.max(y(d.total) - 6, tip.offsetHeight + 6) + 'px';
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
  }

  /* ---------------- 渲染：环形构成 ---------------- */
  function renderDonut(m) {
    const host = $('#donutChart');
    const total = m.total;
    const mainFrac = total > 0 ? m.main / total : 0;
    const partFrac = total > 0 ? m.part / total : 0;
    const R = 64;
    const C = 2 * Math.PI * R;
    const gap = total > 0 ? 2.6 : 0;
    const mainLen = Math.max(mainFrac * C - gap, 0);
    const partLen = Math.max(partFrac * C - gap, 0);
    const partStart = -90 + mainFrac * 360;

    host.innerHTML = `
      <svg viewBox="0 0 170 170" width="170" height="170" role="img" aria-label="收入构成环形图">
        <defs>
          <linearGradient id="gDonutMain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#9C86FF"/>
            <stop offset="100%" stop-color="#5433E2"/>
          </linearGradient>
          <linearGradient id="gDonutPart" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFB29A"/>
            <stop offset="100%" stop-color="#FF6A3D"/>
          </linearGradient>
        </defs>
        <circle cx="85" cy="85" r="${R}" fill="none" stroke="#F5F2FB" stroke-width="17"/>
        <circle cx="85" cy="85" r="${R}" fill="none" stroke="url(#gDonutMain)" stroke-width="17"
          stroke-dasharray="${mainLen.toFixed(2)} ${(C - mainLen).toFixed(2)}"
          transform="rotate(-90 85 85)" stroke-linecap="butt"/>
        <circle cx="85" cy="85" r="${R}" fill="none" stroke="url(#gDonutPart)" stroke-width="17"
          stroke-dasharray="${partLen.toFixed(2)} ${(C - partLen).toFixed(2)}"
          transform="rotate(${partStart.toFixed(2)} 85 85)" stroke-linecap="butt"/>
      </svg>
      <div class="donut-center">
        <b>${total > 0 ? shortMoney(total) : '¥0'}</b>
        <span>${total > 0 ? '年度总收入' : '等待录入'}</span>
      </div>`;

    $('#donutLegend').innerHTML = `
      <li class="legend-item">
        <i style="background:linear-gradient(145deg,#9C86FF,#5433E2)"></i>
        <span class="legend-name">主业</span>
        <span class="legend-val">${money(m.main)}</span>
        <span class="legend-sub">${(mainFrac * 100).toFixed(1)}% · 基薪 / 绩效 / 补贴 / 年终奖</span>
      </li>
      <li class="legend-item">
        <i style="background:linear-gradient(145deg,#FFB29A,#FF6A3D)"></i>
        <span class="legend-name">兼职</span>
        <span class="legend-val">${money(m.part)}</span>
        <span class="legend-sub">${(partFrac * 100).toFixed(1)}% · ${m.count} 个月累计</span>
      </li>`;
  }

  /* ---------------- 渲染：主业明细 ---------------- */
  function renderBreakdown(m) {
    const host = $('#mainBreak');
    const items = [
      { key: 'base', name: '基薪', color: '#6D4AFF' },
      { key: 'perf', name: '绩效', color: '#9C86FF' },
      { key: 'subsidy', name: '补贴', color: '#6FD8C2' },
      { key: 'bonus', name: '年终奖', color: '#FF9F6B' }
    ];
    const max = Math.max.apply(null, items.map((i) => m.breakdown[i.key]).concat([1]));
    host.innerHTML = items
      .map((it) => {
        const v = m.breakdown[it.key];
        const pct = m.main > 0 ? (v / m.main) * 100 : 0;
        return `<div class="break-item">
          <div class="break-top">
            <span class="break-name"><i style="background:${it.color}"></i>${it.name}</span>
            <span class="break-amt">${money(v)}<span>${pct.toFixed(1)}%</span></span>
          </div>
          <div class="break-track"><span data-w="${(v / max) * 100}" style="background:linear-gradient(90deg,${it.color}AA,${it.color})"></span></div>
        </div>`;
      })
      .join('');
    requestAnimationFrame(() => {
      $$('#mainBreak .break-track span').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    });
  }

  /* ---------------- 渲染：年度目标 ---------------- */
  function renderTarget(m) {
    const host = $('#targetRing');
    const target = m.target;
    const pctRaw = target > 0 ? m.total / target : 0;
    const shown = clamp(pctRaw, 0, 1);
    const R = 62;
    const C = 2 * Math.PI * R;
    const len = shown * C;
    const progressArc = len > 1
      ? `<circle cx="78" cy="78" r="${R}" fill="none" stroke="url(#gTarget)" stroke-width="14"
            stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}"
            transform="rotate(-90 78 78)"/>`
      : '';

    host.innerHTML = `
      <div class="target-wrap">
        <svg viewBox="0 0 156 156" width="156" height="156" role="img" aria-label="年度目标进度">
          <defs>
            <linearGradient id="gTarget" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#9C86FF"/>
              <stop offset="55%" stop-color="#6D4AFF"/>
              <stop offset="100%" stop-color="#12B98C"/>
            </linearGradient>
          </defs>
          <circle cx="78" cy="78" r="${R}" fill="none" stroke="#F4F0FC" stroke-width="14"/>
          ${progressArc}
        </svg>
        <div class="target-center">
          <b>${(pctRaw * 100).toFixed(1)}<i>%</i></b>
          <span>目标完成度</span>
        </div>
      </div>
      <div class="target-foot">
        <span>目标 <b>${target > 0 ? money(target) : '未设置'}</b></span>
        <span>${target > 0 ? (m.total >= target ? '已超额' : '还差 ' + money(target - m.total)) : '—'}</span>
      </div>`;
    $('#targetHint').textContent = target > 0 ? `目标 ${shortMoney(target)}` : '未设置';
  }

  /* ---------------- 渲染：兼职 Top 5 ---------------- */
  function renderPartTop(m) {
    const host = $('#partTop');
    const ranked = m.active
      .filter((d) => d.part > 0)
      .sort((a, b) => b.part - a.part)
      .slice(0, 5);
    $('#partTopHint').textContent = `合计 ${money(m.part)}`;

    if (!ranked.length) {
      host.innerHTML = `<li class="rank-empty"><span class="empty-ico">${icon('sparkle')}</span><span>暂无兼职收入记录</span></li>`;
      return;
    }

    const max = Math.max.apply(null, ranked.map((d) => d.part));
    host.innerHTML = ranked
      .map(
        (d, i) => `<li class="rank-item">
          <span class="rank-no">${i + 1}</span>
          <span class="rank-main">
            <span class="rank-name">${d.m} 月</span>
            <span class="rank-note">${d.note || '未填写来源'}</span>
          </span>
          <span class="rank-right">
            <span class="rank-mini"><span data-w="${(d.part / max) * 100}"></span></span>
            <span class="rank-amt">${money(d.part)}</span>
          </span>
        </li>`
      )
      .join('');
    requestAnimationFrame(() => {
      $$('#partTop .rank-mini span').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    });
  }

  /* ---------------- 渲染：累计收入 · 目标轨迹 ---------------- */
  function renderCumulative(m) {
    const host = $('#cumChart');
    if (!host || host.clientWidth < 40) return;
    if (!m.active.length) {
      emptyChart(host, '录入数据后显示累计收入与目标轨迹');
      $('#cumHint').textContent = '—';
      return;
    }

    let acc = 0;
    const data = m.active.map((d) => {
      acc += d.total;
      return { m: d.m, total: d.total, cum: acc };
    });
    const target = m.target;
    const last = data[data.length - 1];

    const W = host.clientWidth;
    const H = 198;
    const pad = { l: 48, r: 12, t: 18, b: 24 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const max = niceMax(Math.max(last.cum, target, 1) * 1.08);
    const x = (month) => pad.l + ((month - 1) / 11) * innerW;
    const y = (v) => pad.t + (1 - v / max) * innerH;

    const pts = data.map((d) => [x(d.m), y(d.cum)]);
    const line = smoothPath(pts, 0.14);
    const area = pts.length > 1
      ? `${line} L${pts[pts.length - 1][0].toFixed(2)},${pad.t + innerH} L${pts[0][0].toFixed(2)},${pad.t + innerH} Z`
      : '';

    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = (max / 3) * i;
      const gy = y(v);
      grid += `<line x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}" stroke="rgba(109,74,255,0.09)" stroke-dasharray="${i === 0 ? '0' : '3 5'}"/>`;
      grid += `<text x="${pad.l - 9}" y="${gy + 3.5}" text-anchor="end" font-size="9" fill="#B3ADC0">${shortMoney(v)}</text>`;
    }

    let pace = '';
    if (target > 0) {
      const pStart = [x(1), y(target / 12)];
      const pEnd = [x(12), y(target)];
      pace = `<line x1="${pStart[0].toFixed(2)}" y1="${pStart[1].toFixed(2)}" x2="${pEnd[0].toFixed(2)}" y2="${pEnd[1].toFixed(2)}" stroke="rgba(18,185,140,0.5)" stroke-dasharray="5 5" stroke-width="1.2"/>
        <g>
          <line x1="${pad.l + 2}" y1="${pad.t + 4}" x2="${pad.l + 16}" y2="${pad.t + 4}" stroke="rgba(18,185,140,0.65)" stroke-dasharray="3 3"/>
          <text x="${pad.l + 21}" y="${pad.t + 7.5}" font-size="9" fill="#12A981">目标轨迹</text>
        </g>`;
    }

    const labelStep = Math.ceil(12 / Math.max(1, Math.floor(innerW / 42)));
    let labels = '';
    for (let mo = 1; mo <= 12; mo++) {
      if ((mo - 1) % labelStep !== 0 && mo !== 12) continue;
      labels += `<text x="${x(mo)}" y="${H - 7}" text-anchor="middle" font-size="9" fill="#B3ADC0">${mo}月</text>`;
    }

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="累计收入与目标轨迹">
        <defs>
          <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#12B98C" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#12B98C" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="gCumLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#6D4AFF"/>
            <stop offset="100%" stop-color="#12B98C"/>
          </linearGradient>
        </defs>
        ${grid}
        ${pace}
        ${area ? `<path d="${area}" fill="url(#gCum)"/>` : ''}
        ${line ? `<path d="${line}" fill="none" stroke="url(#gCumLine)" stroke-width="2.4" stroke-linecap="round"/>` : ''}
        <circle cx="${pts[pts.length - 1][0].toFixed(2)}" cy="${pts[pts.length - 1][1].toFixed(2)}" r="4" fill="#fff" stroke="#12B98C" stroke-width="2.2"/>
        ${labels}
        <rect x="${pad.l}" y="${pad.t}" width="${innerW}" height="${innerH}" fill="transparent" class="hover-zone"/>
      </svg>`;

    $('#cumHint').textContent = target > 0 ? `目标 ${shortMoney(target)}` : '未设置目标';

    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    const svg = $('svg', host);

    svg.addEventListener('mousemove', (ev) => {
      const rect = svg.getBoundingClientRect();
      const mx = ((ev.clientX - rect.left) / rect.width) * W;
      let idx = 0;
      let best = Infinity;
      data.forEach((d, i) => {
        const dx = Math.abs(x(d.m) - mx);
        if (dx < best) {
          best = dx;
          idx = i;
        }
      });
      if (best > 34) {
        tip.classList.remove('show');
        return;
      }
      const d = data[idx];
      const paceVal = target > 0 ? (target / 12) * d.m : 0;
      const lead = d.cum - paceVal;
      const leadRow = target > 0
        ? `<div class="tip-row"><i style="background:${lead >= 0 ? '#12B98C' : '#F0526B'}"></i>${lead >= 0 ? '领先目标' : '落后目标'}<b style="color:${lead >= 0 ? '#5BE3BD' : '#FF93A4'}">${lead >= 0 ? '+' : '-'}${money(Math.abs(lead))}</b></div>`
        : '';
      tip.innerHTML = `
        <div class="tip-m">截至 ${m.year} 年 ${d.m} 月</div>
        <div class="tip-v">${money(d.cum)}</div>
        <div class="tip-row"><i style="background:#6D4AFF"></i>当月收入<b>${money(d.total)}</b></div>
        ${leadRow}`;
      tip.classList.add('show');
      const px = clamp(x(d.m), tip.offsetWidth / 2 + 4, host.clientWidth - tip.offsetWidth / 2 - 4);
      tip.style.left = px + 'px';
      tip.style.top = Math.max(y(d.cum) - 4, tip.offsetHeight + 6) + 'px';
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
  }

  /* ---------------- 渲染：里程碑 ---------------- */
  function renderMilestones(m) {
    const rows = [
      {
        icon: 'trophy',
        cls: '',
        label: '最佳月份',
        value: m.count ? `${m.best.m} 月 · ${money(m.best.total)}` : '暂无数据'
      },
      {
        icon: 'flame',
        cls: 'coral',
        label: '兼职最强月',
        value: m.bestPart && m.bestPart.part > 0 ? `${m.bestPart.m} 月 · ${money(m.bestPart.part)}` : '暂无兼职'
      },
      {
        icon: 'chart',
        cls: 'teal',
        label: '最长连涨',
        value: m.streak > 1 ? `${m.streak} 个月` : '持平或下降'
      },
      {
        icon: 'target',
        cls: '',
        label: '目标完成度',
        value: m.target > 0 ? `${(m.progress * 100).toFixed(1)}%` : '未设置目标'
      }
    ];
    $('#milestones').innerHTML = rows
      .map(
        (r) => `<div class="mile">
          <span class="mile-ico ${r.cls}">${icon(r.icon)}</span>
          <div class="mile-body">
            <p class="mile-label">${r.label}</p>
            <p class="mile-value">${r.value}</p>
          </div>
        </div>`
      )
      .join('');
  }

  /* ---------------- 渲染：热力条 ---------------- */
  function renderHeat(m) {
    const host = $('#heatStrip');
    const max = Math.max.apply(null, m.months.map((d) => d.total).concat([1]));
    host.innerHTML = m.months
      .map((d) => {
        if (d.total <= 0) {
          return `<div class="heat-cell empty" title="${d.m} 月 · 暂无数据">
            <span class="heat-m">${d.m} 月</span><span class="heat-v">—</span>
          </div>`;
        }
        const ratio = d.total / max;
        const bg = mixViolet(ratio);
        const light = ratio < 0.55;
        const title = `${d.m} 月 · ${money(d.total)}（主业 ${money(d.main)} / 兼职 ${money(d.part)}）`;
        return `<div class="heat-cell" style="background:${bg};color:${light ? '#4A4358' : '#fff'};border-color:transparent" title="${title}">
          <span class="heat-m">${d.m} 月</span>
          <span class="heat-v">${shortMoney(d.total)}</span>
        </div>`;
      })
      .join('');
  }

  /* ---------------- 总渲染 ---------------- */
  function renderCharts(m) {
    renderSpark(m);
    renderTrend(m);
    renderStack(m);
    renderDonut(m);
    renderTarget(m);
    renderCumulative(m);
  }

  function renderAll() {
    model = buildModel(activeYear);
    renderYearSwitch();
    renderHero(model);
    renderKpis(model);
    renderBreakdown(model);
    renderPartTop(model);
    renderMilestones(model);
    renderHeat(model);
    renderCharts(model);
  }

  /* ---------------- 编辑抽屉 ---------------- */
  const drawer = $('#drawer');
  const mask = $('#mask');
  let editorYear = activeYear;

  function openEditor() {
    editorYear = activeYear;
    buildYearOptions();
    buildEditorRows();
    drawer.classList.add('open');
    mask.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (window.innerWidth > 720) {
      setTimeout(() => {
        const first = $('#entryBody input');
        if (first) first.focus({ preventScroll: true });
      }, 380);
    }
  }

  function closeEditor() {
    drawer.classList.remove('open');
    mask.classList.remove('show');
    document.body.style.overflow = '';
  }

  function buildYearOptions() {
    const sel = $('#editorYear');
    const years = Object.keys(state.years).sort();
    sel.innerHTML = years.map((y) => `<option value="${y}">${y} 年</option>`).join('');
    sel.value = editorYear;
    $('#targetInput').value = num(state.settings.targets[editorYear]) || '';
  }

  function buildEditorRows() {
    const rows = state.years[editorYear] || [];
    $('#entryBody').innerHTML = rows
      .map((r) => {
        const main = num(r.base) + num(r.perf) + num(r.subsidy) + num(r.bonus);
        const total = main + num(r.part);
        return `<tr data-m="${r.m}" class="${total > 0 ? '' : 'is-empty'}">
          <td class="month-cell"><span class="month-badge">${r.m} 月<em>${total > 0 ? '已录' : '空'}</em></span></td>
          <td><input type="number" min="0" step="100" inputmode="numeric" data-field="base" value="${r.base || ''}" placeholder="0"></td>
          <td><input type="number" min="0" step="100" inputmode="numeric" data-field="perf" value="${r.perf || ''}" placeholder="0"></td>
          <td><input type="number" min="0" step="100" inputmode="numeric" data-field="subsidy" value="${r.subsidy || ''}" placeholder="0"></td>
          <td><input type="number" min="0" step="100" inputmode="numeric" data-field="bonus" value="${r.bonus || ''}" placeholder="0"></td>
          <td><input type="number" min="0" step="100" inputmode="numeric" data-field="part" value="${r.part || ''}" placeholder="0"></td>
          <td><input type="text" maxlength="24" data-field="note" class="note-input" value="${escapeAttr(r.note)}" placeholder="如：插画 / 课程"></td>
          <td class="total-cell">${total > 0 ? plain(total) : '—'}</td>
        </tr>`;
      })
      .join('');
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function bindEditor() {
    $('#entryBody').addEventListener('input', (ev) => {
      const input = ev.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;
      if (input.value !== '') {
        const v = Number(input.value);
        if (Number.isFinite(v) && v < 0) input.value = '0';
      }
      const tr = input.closest('tr');
      const total = ['base', 'perf', 'subsidy', 'bonus', 'part'].reduce((acc, f) => {
        const el = tr.querySelector(`[data-field="${f}"]`);
        return acc + num(el ? el.value : 0);
      }, 0);
      tr.classList.toggle('is-empty', total <= 0);
      tr.querySelector('.total-cell').textContent = total > 0 ? plain(total) : '—';
      const badge = tr.querySelector('.month-badge em');
      if (badge) badge.textContent = total > 0 ? '已录' : '空';
    });

    $('#editorYear').addEventListener('change', (ev) => {
      editorYear = ev.target.value;
      buildEditorRows();
      $('#targetInput').value = num(state.settings.targets[editorYear]) || '';
    });

    $('#saveData').addEventListener('click', () => {
      const rows = $$('#entryBody tr').map((tr) => {
        const get = (f) => {
          const el = tr.querySelector(`[data-field="${f}"]`);
          return el ? num(el.value) : 0;
        };
        const noteEl = tr.querySelector('[data-field="note"]');
        return {
          m: Number(tr.dataset.m),
          base: get('base'),
          perf: get('perf'),
          subsidy: get('subsidy'),
          bonus: get('bonus'),
          part: get('part'),
          note: noteEl ? noteEl.value.trim() : ''
        };
      });

      state.years[editorYear] = rows;
      state.settings.targets[editorYear] = Math.max(0, Math.round(Number($('#targetInput').value) || 0));
      state.settings.updateDate = today();
      activeYear = editorYear;

      if (!saveState()) {
        toast('保存失败：浏览器可能禁用了本地存储');
        return;
      }
      closeEditor();
      renderAll();
      toast('已保存到本机浏览器');
    });

    $('#resetData').addEventListener('click', () => {
      const ok = window.confirm('确定清空所有年份的录入数据吗？此操作不可撤销。');
      if (!ok) return;
      state = normalize(SEED);
      saveState();
      editorYear = Object.keys(state.years).sort().pop();
      buildYearOptions();
      buildEditorRows();
      activeYear = editorYear;
      renderAll();
      toast('已清空，可以开始重新录入');
    });

    $('#openEditor').addEventListener('click', openEditor);
    $('#heroCta')?.addEventListener('click', openEditor);
    $('#closeEditor').addEventListener('click', closeEditor);
    $('#cancelEdit').addEventListener('click', closeEditor);
    mask.addEventListener('click', closeEditor);

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && drawer.classList.contains('open')) closeEditor();
    });
  }

  /* ---------------- 交互 ---------------- */
  function bindGlobal() {
    $('#yearSwitch').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-year]');
      if (!btn) return;
      const y = btn.dataset.year;
      if (y === activeYear) return;
      activeYear = y;
      renderAll();
    });

    $$('#navLinks a').forEach((a) => {
      a.addEventListener('click', () => {
        $$('#navLinks a').forEach((x) => x.classList.remove('active'));
        a.classList.add('active');
      });
    });

    const sections = ['overview', 'trend', 'mix', 'detail']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if ('IntersectionObserver' in window) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            $$('#navLinks a').forEach((a) => {
              a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
          });
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );
      sections.forEach((s) => spy.observe(s));
    }

    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.style.transitionDelay = `${Math.min(i * 50, 150)}ms`;
          el.classList.add('in');
          reveal.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
    );
    $$('.reveal').forEach((el) => reveal.observe(el));

    let resizeTimer = null;
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (model) renderCharts(model);
      }, 180);
    });
  }

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------------- 开场动画 ---------------- */
  function initIntro() {
    const intro = document.getElementById('intro');
    if (!intro) return;

    const word = intro.querySelector('.intro-word');
    if (word) {
      const chars = Array.from(word.textContent.trim());
      word.textContent = '';
      chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.setProperty('--i', i);
        word.appendChild(span);
      });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      intro.remove();
      return;
    }

    document.body.classList.add('intro-active');
    let finished = false;
    let timer = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      intro.classList.add('exiting');
      document.body.classList.remove('intro-active');
      setTimeout(() => intro.remove(), 900);
    };

    timer = setTimeout(finish, 4350);
    const skip = document.getElementById('introSkip');
    if (skip) skip.addEventListener('click', finish);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') finish();
    });
  }

  /* ---------------- 启动 ---------------- */
  initIntro();
  hydrateIcons();
  bindEditor();
  bindGlobal();
  renderAll();
})();
