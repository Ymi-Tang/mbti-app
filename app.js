/* ============================================================
 * MBTI 极速测 · 核心逻辑
 * 纯前端：计分 / URL 编码回看 / 好友匹配 / canvas 分享卡
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 常量与工具 ---------- */
  const $ = (id) => document.getElementById(id);
  const TYPES_LIST = Object.keys(TYPES);
  const PORT = (t) => 'portraits/' + t.toLowerCase() + '.jpg';
  const BASE = location.origin + location.pathname;
  const DIM_ORDER = ['EI', 'SN', 'TF', 'JP'];
  const DIM_LETTERS = { EI: ['E', 'I'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] };

  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms || 2200);
  }

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
    $(id).classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function makeUrl(params) {
    const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    return BASE + (q ? '?' + q : '');
  }

  /* ---------- URL 编解码 ---------- */
  function encodeResult(type, dims) {
    const payload = JSON.stringify({ t: type, d: dims });
    return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeResult(code) {
    try {
      const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      return JSON.parse(atob(b64 + pad));
    } catch (e) { return null; }
  }

  /* ---------- 状态 ---------- */
  let quiz = { answers: [], idx: 0 };
  let invitedPartner = null; // 从邀请链接进入时，记下邀请人(伙伴)的 code

  /* ---------- 开始页 ---------- */
  function showStart() {
    const grid = $('startGrid');
    if (!grid.childElementCount) {
      grid.innerHTML = TYPES_LIST.map(t =>
        '<span><img src="' + PORT(t) + '" alt="" loading="lazy"></span>').join('');
    }
    showView('view-start');
  }

  function startQuiz() {
    quiz = { answers: [], idx: 0 };
    renderQuiz();
  }

  /* ---------- 测评流程 ---------- */
  function renderQuiz() {
    const q = QUESTIONS[quiz.idx];
    $('quizCount').textContent = 'Q ' + (quiz.idx + 1) + ' / ' + QUESTIONS.length;
    $('quizDim').textContent = q.dim.split('').join(' / ');
    $('progressBar').style.width = ((quiz.idx + 1) / QUESTIONS.length * 100) + '%';
    $('quizQ').textContent = q.q;
    $('optA').querySelector('.opt-text').textContent = q.a;
    $('optB').querySelector('.opt-text').textContent = q.b;
    $('btnPrev').style.visibility = quiz.idx === 0 ? 'hidden' : 'visible';
    showView('view-quiz');
  }

  function choose(side) {
    quiz.answers[quiz.idx] = side;
    const el = side === 0 ? $('optA') : $('optB');
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 200);
    setTimeout(() => {
      if (quiz.idx < QUESTIONS.length - 1) {
        quiz.idx++;
        renderQuiz();
      } else {
        finishQuiz();
      }
    }, 240);
  }

  function prevQuestion() {
    if (quiz.idx > 0) { quiz.idx--; renderQuiz(); }
  }

  function scoreQuiz() {
    const counts = { EI: [0, 0], SN: [0, 0], TF: [0, 0], JP: [0, 0] };
    QUESTIONS.forEach((q, i) => {
      const side = quiz.answers[i];
      if (side === 0 || side === 1) counts[q.dim][side]++;
    });
    let type = '';
    const dims = {};
    DIM_ORDER.forEach(d => {
      const [a, b] = counts[d];
      const [la, lb] = DIM_LETTERS[d];
      type += a >= b ? la : lb;
      dims[d] = [Math.round(a / 5 * 100), Math.round(b / 5 * 100)];
    });
    return { type, dims };
  }

  function finishQuiz() {
    try {
      const { type, dims } = scoreQuiz();
      console.log('finishQuiz: type=' + type + ' dims=' + JSON.stringify(dims));
      const code = encodeResult(type, dims);
      console.log('finishQuiz: code=' + code.substring(0, 30) + '...');
      const params = { r: code };
      if (invitedPartner) { params.p = invitedPartner; invitedPartner = null; }
      history.replaceState(null, '', makeUrl(params));
      if (params.p) { showMatch(code, params.p); }
      else { renderResult(code, false); }
    } catch (e) {
      console.error('finishQuiz error:', e);
      var box = document.getElementById('errBox');
      if (box) { box.style.display = 'block'; box.innerHTML = '<b>finishQuiz 错误:</b> ' + e.message + '<br><b>堆栈:</b> ' + (e.stack||'').substring(0,500); }
    }
  }

  /* ---------- 结果页 ---------- */
  function renderResult(code, invited) {
    try {
    const data = decodeResult(code);
    console.log('renderResult: code=' + code.substring(0,20) + ' data=' + JSON.stringify(data));
    if (!data || !TYPES[data.type]) { console.log('renderResult: data invalid or type not found, going to start'); showStart(); return; }
    const t = TYPES[data.type];

    // 身份条
    $('resultRibbon').innerHTML = data.type.split('').map(ch =>
      '<i style="background:' + DIM_COLORS[ch] + '"></i>').join('');

    $('resultPortrait').src = PORT(data.type);
    $('resultLetters').textContent = data.type;
    $('resultName').textContent = t.name + ' · ' + t.spirit;
    $('resultMotto').textContent = '“' + t.motto + '”';

    // 维度条 + 中文名
    $('resultDims').innerHTML = DIM_ORDER.map(d => {
      const [la, lb] = DIM_LETTERS[d];
      const [na, nb] = DIM_NAMES[d];
      const left = data.d[d][0];
      return '<div class="dim">' +
        '<span class="dim-side">' + la + '</span>' +
        '<span class="dim-pct-label">' + left + '%</span>' +
        '<div class="dim-track"><div class="dim-fill" style="width:' + left + '%;background:' + DIM_COLORS[la] + '"></div></div>' +
        '<span class="dim-pct-label">' + data.d[d][1] + '%</span>' +
        '<span class="dim-side">' + lb + '</span></div>' +
        '<div class="dim-labels"><span>' + na + '</span><span>' + nb + '</span></div>';
    }).join('');

    $('resultHighlights').innerHTML = t.highlights.map(h => '<li>' + h + '</li>').join('');
    const celebs = t.celebrities || t.celebs || [];
    $('resultCelebs').innerHTML = celebs.map(c => '<span>' + c + '</span>').join('');
    $('resultJobs').innerHTML = t.jobs.map(j => '<span>' + j + '</span>').join('');

    // 邀请横幅 + 按钮文案
    const banner = $('inviteBanner');
    if (banner) banner.style.display = invited ? 'block' : 'none';
    $('btnRetest').textContent = invited ? '我也来测一次' : '再测一次';

    showView('view-result');
    console.log('renderResult: done, view switched');
    } catch (e) {
      console.error('renderResult error:', e);
      var box = document.getElementById('errBox');
      if (box) { box.style.display = 'block'; box.innerHTML = '<b>renderResult 错误:</b> ' + e.message + '<br><b>堆栈:</b> ' + (e.stack||'').substring(0,500); }
    }
  }

  /* ---------- 匹配页 ---------- */
  function pairCardHTML(type) {
    const t = TYPES[type];
    return '<img src="' + PORT(type) + '" alt="' + t.name + '">' +
      '<div class="pc-letters">' + type + '</div>' +
      '<div class="pc-name">' + t.name + '</div>';
  }

  function matchPercent(a, b) {
    let same = 0;
    for (let i = 0; i < 4; i++) if (a[i] === b[i]) same++;
    return { same, pct: same * 25 };
  }

  function showMatch(meCode, partnerCode) {
    const me = decodeResult(meCode);
    const fr = decodeResult(partnerCode);
    if (!me || !fr || !TYPES[me.type] || !TYPES[fr.type]) { showStart(); return; }

    $('pairCardMe').innerHTML = pairCardHTML(me.type);
    $('pairCardFriend').innerHTML = pairCardHTML(fr.type);

    const { same, pct } = matchPercent(me.type, fr.type);
    const line = MATCH_LINES.find(m => m.score.includes(same)) || MATCH_LINES[0];

    const C = 2 * Math.PI * 72;
    $('matchScore').innerHTML =
      '<svg viewBox="0 0 168 168">' +
      '<circle class="ring-bg" cx="84" cy="84" r="72"></circle>' +
      '<circle class="ring-fg" cx="84" cy="84" r="72" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" id="ringFg"></circle>' +
      '</svg>' +
      '<div class="score-num"><span class="num">' + pct + '<small>%</small></span><span class="sub">' + same + '/4 字母相同</span></div>';
    $('matchLine').textContent = '【' + line.title + '】' + line.desc;

    showView('view-match');
    requestAnimationFrame(() => {
      const ring = $('ringFg');
      if (ring) ring.style.strokeDashoffset = C * (1 - pct / 100);
    });
  }

  /* ---------- 复制 ---------- */
  function copyText(text, okMsg) {
    const done = () => toast(okMsg);
    const fail = () => toast('复制失败，请手动长按选择链接');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done, fail));
    } else {
      fallbackCopy(text, done, fail);
    }
  }
  function fallbackCopy(text, done, fail) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { fail(); }
    document.body.removeChild(ta);
  }

  /* ---------- canvas 分享卡 ---------- */
  const S_W = 1080, S_H = 1620;
  const FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';

  function loadImg(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapText(ctx, text, cx, y, maxWidth, lineHeight, fontSize) {
    ctx.font = '600 ' + fontSize + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3A3A44';
    let line = '', curY = y;
    for (let i = 0; i < text.length; i++) {
      const test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, curY);
        line = text[i];
        curY += lineHeight;
      } else { line = test; }
    }
    ctx.fillText(line, cx, curY);
  }

  async function drawShareCard(type, dims, mode, partnerType) {
    const canvas = document.createElement('canvas');
    canvas.width = S_W; canvas.height = S_H;
    const ctx = canvas.getContext('2d');
    const t = TYPES[type];
    const cx = S_W / 2;

    // 背景
    const bg = ctx.createLinearGradient(0, 0, S_W, S_H);
    bg.addColorStop(0, '#FFF6EC'); bg.addColorStop(.55, '#F3F5FB'); bg.addColorStop(1, '#F5F0FA');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S_W, S_H);

    // 顶部四色身份条
    type.split('').forEach((ch, i) => {
      ctx.fillStyle = DIM_COLORS[ch];
      ctx.fillRect(i * S_W / 4, 0, S_W / 4, 64);
    });
    ctx.fillStyle = '#23232C'; ctx.fillRect(0, 64, S_W, 8);

    if (mode === 'single') {
      const img = await loadImg(PORT(type));
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, 330, 190, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, cx - 190, 140, 380, 380);
      ctx.restore();
      ctx.lineWidth = 12; ctx.strokeStyle = '#23232C';
      ctx.beginPath(); ctx.arc(cx, 330, 190, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = '#23232C';
      ctx.font = '900 132px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(type, cx, 640);
      ctx.font = '800 54px ' + FONT;
      ctx.fillText(t.name + ' · ' + t.spirit, cx, 716);
      ctx.font = '600 40px ' + FONT; ctx.fillStyle = '#6B6B76';
      ctx.fillText('“' + t.motto + '”', cx, 790);

      let y = 880;
      DIM_ORDER.forEach(d => {
        const [la, lb] = DIM_LETTERS[d];
        const left = dims[d][0];
        ctx.font = '900 44px ' + FONT; ctx.textAlign = 'left';
        ctx.fillStyle = '#23232C'; ctx.fillText(la, 120, y + 30);
        // track
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, 200, y - 26, S_W - 400, 56, 28); ctx.fill();
        ctx.strokeStyle = '#23232C'; ctx.lineWidth = 6; ctx.stroke();
        // fill
        if (left > 0) {
          ctx.fillStyle = DIM_COLORS[la];
          roundRect(ctx, 200, y - 26, (S_W - 400) * left / 100, 56, 28); ctx.fill();
        }
        ctx.font = '900 36px ' + FONT; ctx.textAlign = 'right';
        ctx.fillStyle = '#23232C'; ctx.fillText(left + '%', S_W - 200, y + 30);
        ctx.textAlign = 'left'; ctx.fillText(lb, S_W - 160, y + 30);
        y += 130;
      });

      ctx.fillStyle = '#23232C';
      ctx.font = '900 52px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(BRAND.name, cx, y + 30);
      ctx.font = '600 32px ' + FONT; ctx.fillStyle = '#9A9AA4';
      ctx.fillText('长按保存 · 仅供娱乐参考', cx, y + 86);
    } else {
      const imgA = await loadImg(PORT(type));
      const imgB = await loadImg(PORT(partnerType));
      [[type, imgA, cx - 330], [partnerType, imgB, cx + 330]].forEach(([ty, im, x]) => {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, 340, 160, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(im, x - 160, 180, 320, 320);
        ctx.restore();
        ctx.lineWidth = 10; ctx.strokeStyle = '#23232C';
        ctx.beginPath(); ctx.arc(x, 340, 160, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '900 76px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#23232C';
        ctx.fillText(ty, x, 580);
        ctx.font = '700 40px ' + FONT;
        ctx.fillText(TYPES[ty].name, x, 640);
      });

      ctx.fillStyle = '#FF4D6D';
      ctx.font = '900 90px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('×', cx, 380);

      const { same, pct } = matchPercent(type, partnerType);
      const line = MATCH_LINES.find(m => m.score.includes(same)) || MATCH_LINES[0];
      ctx.font = '900 110px ' + FONT; ctx.fillStyle = '#23232C'; ctx.textAlign = 'center';
      ctx.fillText(pct + '%', cx, 820);
      ctx.font = '700 46px ' + FONT; ctx.fillStyle = '#FF4D6D';
      ctx.fillText('匹配度 · ' + same + '/4 字母相同', cx, 896);

      ctx.font = '700 44px ' + FONT; ctx.fillStyle = '#23232C';
      ctx.fillText('【' + line.title + '】', cx, 990);
      wrapText(line.desc, cx, 1060, S_W - 240, 60, 40);

      ctx.font = '900 52px ' + FONT; ctx.fillStyle = '#23232C';
      ctx.fillText(BRAND.name, cx, 1450);
      ctx.font = '600 32px ' + FONT; ctx.fillStyle = '#9B9BA6';
      ctx.fillText('一起来测你们的性格 CP · 仅供娱乐', cx, 1510);
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  async function openShareCard(type, dims, mode, partnerType) {
    toast('正在生成卡片…', 1200);
    try {
      const url = await drawShareCard(type, dims, mode, partnerType);
      $('shareImg').src = url;
      $('shareModal').hidden = false;
    } catch (e) {
      toast('生成失败，请重试');
    }
  }

  /* ---------- 路由 ---------- */
  function route() {
    const q = new URLSearchParams(location.search);
    const r = q.get('r');
    const p = q.get('p');
    const inv = q.get('inv');

    if (r) {
      const data = decodeResult(r);
      if (data && TYPES[data.type]) {
        if (p) {
          const pd = decodeResult(p);
          if (pd && TYPES[pd.type]) { showMatch(r, p); return; }
        }
        if (inv) invitedPartner = r;
        renderResult(r, !!inv);
        return;
      }
    }
    showStart();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('btnStart').addEventListener('click', startQuiz);
    $('optA').addEventListener('click', () => choose(0));
    $('optB').addEventListener('click', () => choose(1));
    $('btnPrev').addEventListener('click', prevQuestion);

    $('btnShare').addEventListener('click', async () => {
      const code = new URLSearchParams(location.search).get('r');
      const d = decodeResult(code);
      if (d) openShareCard(d.type, d.d, 'single');
    });

    $('btnMatchShare').addEventListener('click', async () => {
      const q = new URLSearchParams(location.search);
      const me = decodeResult(q.get('r')), fr = decodeResult(q.get('p'));
      if (me && fr) openShareCard(me.type, me.d, 'pair', fr.type);
    });

    $('btnShareDone').addEventListener('click', () => { $('shareModal').hidden = true; });
    $('shareMask').addEventListener('click', () => { $('shareModal').hidden = true; });

    $('btnInvite').addEventListener('click', () => {
      const code = new URLSearchParams(location.search).get('r');
      if (code) copyText(makeUrl({ r: code, inv: 1 }), '邀请链接已复制，发给 TA 吧');
    });

    $('btnRetest').addEventListener('click', startQuiz);
    $('btnMatchRetest').addEventListener('click', startQuiz);
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    bind();
    route();
  });
})();