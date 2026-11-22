/* ============ 辉光时钟 NixieClock 主逻辑 ============ */
'use strict';

const $ = (s) => document.querySelector(s);
const HAS_NL = typeof window.NL_PORT !== 'undefined';
if (HAS_NL) Neutralino.init();

/* ============ 顶部常量（按需修改） ============ */
const APP_VERSION = '1.1.7';
// 翻页动画时长（与 CSS 中 --flipDur 保持一致）
const FLIP_MS = 600;
// 版本清单 URL：返回 JSON {"version":"1.1.0","url":"https://.../下载页"}；留空则提示未配置
const UPDATE_URL = '';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
// 多显示器枚举命令：每屏输出一行「是否主屏|x|y|宽|高」
const SCREEN_PS = 'powershell -NoProfile -EncodedCommand QQBkAGQALQBUAHkAcABlACAALQBUAHkAcABlAEQAZQBmAGkAbgBpAHQAaQBvAG4AIAAnAHUAcwBpAG4AZwAgAFMAeQBzAHQAZQBtAC4AUgB1AG4AdABpAG0AZQAuAEkAbgB0AGUAcgBvAHAAUwBlAHIAdgBpAGMAZQBzADsAIABwAHUAYgBsAGkAYwAgAGMAbABhAHMAcwAgAEQAIAB7ACAAWwBEAGwAbABJAG0AcABvAHIAdAAoACIAdQBzAGUAcgAzADIALgBkAGwAbAAiACkAXQAgAHAAdQBiAGwAaQBjACAAcwB0AGEAdABpAGMAIABlAHgAdABlAHIAbgAgAGIAbwBvAGwAIABTAGUAdABQAHIAbwBjAGUAcwBzAEQAUABJAEEAdwBhAHIAZQAoACkAOwAgAH0AJwAKAFsARABdADoAOgBTAGUAdABQAHIAbwBjAGUAcwBzAEQAUABJAEEAdwBhAHIAZQAoACkACgBBAGQAZAAtAFQAeQBwAGUAIAAtAEEAcwBzAGUAbQBiAGwAeQBOAGEAbQBlACAAUwB5AHMAdABlAG0ALgBXAGkAbgBkAG8AdwBzAC4ARgBvAHIAbQBzAAoAWwBTAHkAcwB0AGUAbQAuAFcAaQBuAGQAbwB3AHMALgBGAG8AcgBtAHMALgBTAGMAcgBlAGUAbgBdADoAOgBBAGwAbABTAGMAcgBlAGUAbgBzACAAfAAgAEYAbwByAEUAYQBjAGgALQBPAGIAagBlAGMAdAAgAHsAIAAnAHsAMAB9AHwAewAxAH0AfAB7ADIAfQB8AHsAMwB9AHwAewA0AH0AJwAgAC0AZgAgACQAXwAuAFAAcgBpAG0AYQByAHkALAAgACQAXwAuAEIAbwB1AG4AZABzAC4AWAAsACAAJABfAC4AQgBvAHUAbgBkAHMALgBZACwAIAAkAF8ALgBCAG8AdQBuAGQAcwAuAFcAaQBkAHQAaAAsACAAJABfAC4AQgBvAHUAbgBkAHMALgBIAGUAaQBnAGgAdAAgAH0A';

/* ============================================================
   七段数码管渲染器（辉光管 / 赛博 共用）
   ============================================================ */
const SEG_PTS = {
  a: '21,10 30,1 70,1 79,10 70,19 30,19',
  b: '90,15 99,24 99,81 90,90 81,81 81,24',
  c: '90,100 99,109 99,166 90,175 81,166 81,109',
  d: '21,180 30,171 70,171 79,180 70,189 30,189',
  e: '10,100 19,109 19,166 10,175 1,166 1,109',
  f: '10,15 19,24 19,81 10,90 1,81 1,24',
  g: '21,95 30,86 70,86 79,95 70,104 30,104',
};
const DIGIT_SEGS = {
  '0': 'abcdef', '1': 'bc',    '2': 'abged', '3': 'abgcd',
  '4': 'fgbc',   '5': 'afgcd', '6': 'afgedc','7': 'abc',
  '8': 'abcdefg','9': 'abcdfg',
};

function makeDigit() {
  const div = document.createElement('div');
  div.className = 'digit';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 190');
  for (const key of Object.keys(SEG_PTS)) {
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', SEG_PTS[key]);
    poly.dataset.seg = key;
    svg.appendChild(poly);
  }
  div.appendChild(svg);
  return div;
}

function setDigit(digitEl, ch) {
  const on = DIGIT_SEGS[ch] || '';
  digitEl.querySelectorAll('polygon').forEach((p) => {
    p.classList.toggle('on', on.includes(p.dataset.seg));
  });
}

function makeColon() {
  const c = document.createElement('div');
  c.className = 'colon';
  c.innerHTML = '<span></span><span></span>';
  return c;
}

// 构建时间行：H H : M M : S S
const segRow = $('#segRow');
const segDigits = [];
{
  const layout = ['d', 'd', 'c', 'd', 'd', 'c', 'd', 'd'];
  for (const t of layout) {
    if (t === 'c') segRow.appendChild(makeColon());
    else { const d = makeDigit(); segDigits.push(d); segRow.appendChild(d); }
  }
}

/* ============================================================
   翻页卡渲染器
   ============================================================ */
function makeFlipCard() {
  const card = document.createElement('div');
  card.className = 'fcard';
  card.dataset.v = '0';
  card._landAt = 0; // 翻页落位时刻（0=无待落位）
  card.innerHTML =
    '<div class="half top"><div class="num"></div></div>' +
    '<div class="half bottom"><div class="num"></div></div>' +
    '<div class="sh bot"></div>' +
    '<div class="leaf leafTop"><div class="face front"><div class="num"></div></div><div class="face back"><div class="num"></div></div></div>' +
    '<div class="sh mid"></div>' +
    '<div class="sh dark"></div>';
  // 四个显示位使用与辉光管/赛博一致的七段码
  card._dTop = makeDigit();   // 静态上半：翻页开始即换新值
  card._dBot = makeDigit();   // 静态下半：落位后才换新值
  card._dFront = makeDigit(); // 翻页叶正面：旧值上半
  card._dBack = makeDigit();  // 翻页叶背面：新值下半
  card.querySelector('.half.top .num').appendChild(card._dTop);
  card.querySelector('.half.bottom .num').appendChild(card._dBot);
  card.querySelector('.face.front .num').appendChild(card._dFront);
  card.querySelector('.face.back .num').appendChild(card._dBack);
  [card._dTop, card._dBot, card._dFront, card._dBack].forEach((d) => setDigit(d, '0'));
  return card;
}

function setFlip(card, nv) {
  const cur = card.dataset.v;
  if (nv === cur) return;
  // 上一次翻转若未落位，先把静态下半补齐为上次目标值，避免上下半错位闪断
  if (card._landAt) setDigit(card._dBot, cur);
  card.dataset.v = nv;

  const lt = card.querySelector('.leafTop');
  lt.classList.remove('run-t');
  card.classList.remove('sh-run');

  // 经典翻页：叶正面=旧值上半，叶背面=新值下半；90° 时露出静态上半的新值
  setDigit(card._dFront, cur);
  setDigit(card._dBack, nv);
  setDigit(card._dTop, nv);
  void lt.offsetWidth; // 重启动画
  lt.classList.add('run-t');
  card.classList.add('sh-run');
  // 落位由 tick 统一收敛：setTimeout 在窗口被遮挡/后台节流时不可靠，会导致翻页叶卡住、下半停留旧值
  card._landAt = Date.now() + FLIP_MS;
}

const flipCards = [];
for (const groupId of ['flipHour', 'flipMin', 'flipSec']) {
  const g = document.getElementById(groupId);
  const pair = [makeFlipCard(), makeFlipCard()];
  pair.forEach((c) => g.appendChild(c));
  flipCards.push(pair);
}

/* ============================================================
   时钟节拍
   ============================================================ */
const WEEK_CN = '日一二三四五六';
const p2 = (n) => String(n).padStart(2, '0');
const segView = $('#segView');

let lastSec = -1;

function tick() {
  // 落位收敛放在最前：每 200ms 都检查，不依赖秒变化（秒变化检查会被 early-return 拦截，延迟可达 1 秒）
  const ms = Date.now();
  for (const c of flipCards.flat()) {
    if (c._landAt && ms >= c._landAt) {
      c._landAt = 0;
      setDigit(c._dBot, c.dataset.v);
      c.querySelector('.leafTop').classList.remove('run-t');
      c.classList.remove('sh-run');
    }
  }

  const now = new Date();
  const h = p2(now.getHours());
  const m = p2(now.getMinutes());
  const s = p2(now.getSeconds());
  const changed = s !== lastSec;
  if (!changed && lastSec !== -1) return;
  lastSec = s;

  const bodyMode = document.body.classList.contains('mode-flip') ? 'flip' : 'seg';
  if (bodyMode === 'flip') {
    const chars = h + m + s;
    flipCards.forEach((pair, i) => {
      setFlip(pair[0], chars[i * 2]);
      setFlip(pair[1], chars[i * 2 + 1]);
    });
  } else {
    const chars = h + m + s;
    segDigits.forEach((d, i) => setDigit(d, chars[i]));
  }

  const dateStr = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} 星期${WEEK_CN[now.getDay()]}`;
  $('#segDate').textContent = dateStr;
  $('#flipDate').textContent = dateStr;
}
setInterval(tick, 200);
tick();

/* ============================================================
   模式切换
   ============================================================ */
const MODES = ['nixie', 'flip', 'cyber'];

function setMode(name, animate = true) {
  MODES.forEach((m) => document.body.classList.toggle('mode-' + m, m === name));
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.classList.toggle('on', b.dataset.mode === name));
  if (animate) {
    const v = name === 'flip' ? $('#flipView') : segView;
    v.classList.remove('view-in');
    void v.offsetWidth;
    v.classList.add('view-in');
  }
  if (name === 'cyber') startRain(); else stopRain();
  lastSec = -1; // 强制刷新显示
  tick();
  try { localStorage.setItem('nixie-mode', name); } catch (e) { /* ignore */ }
}

document.querySelectorAll('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));

let saved = 'nixie';
try { saved = localStorage.getItem('nixie-mode') || 'nixie'; } catch (e) { /* ignore */ }
if (!MODES.includes(saved)) saved = 'nixie';
// URL ?mode= 可强制指定初始模式（调试/截图用）
const qMode = new URLSearchParams(location.search).get('mode');
if (qMode && MODES.includes(qMode)) saved = qMode;

/* ============================================================
   赛博模式：数字雨（低密度 30fps）+ 故障闪烁
   ============================================================ */
const rain = $('#rain');
const rctx = rain.getContext('2d');
let rainRAF = null;
let rainCols = [];
const GLYPHS = '0123456789ABCDEF<>[]{}/*+=_';

function resizeRain() {
  rain.width = Math.floor(window.innerWidth);
  rain.height = Math.floor(window.innerHeight);
  const colW = 26;
  const n = Math.ceil(rain.width / colW);
  rainCols = Array.from({ length: n }, () =>
    ({ y: Math.random() * -rain.height, sp: 90 + Math.random() * 160 }));
  rctx.fillStyle = '#04060e';
  rctx.fillRect(0, 0, rain.width, rain.height);
}
window.addEventListener('resize', resizeRain);

let rainLast = 0;
function rainLoop(t) {
  if (!document.body.classList.contains('mode-cyber')) { rainRAF = null; return; }
  if (t - rainLast >= 33) { // ~30fps
    rainLast = t;
    rctx.fillStyle = 'rgba(4, 6, 14, .14)';
    rctx.fillRect(0, 0, rain.width, rain.height);
    rctx.font = '14px Consolas, monospace';
    const colW = 26;
    rainCols.forEach((c, i) => {
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      rctx.fillStyle = Math.random() < .08 ? '#9ef7ff' : 'rgba(0, 220, 255, .8)';
      rctx.fillText(ch, i * colW, c.y);
      c.y += c.sp / 30;
      if (c.y > rain.height + 20) c.y = Math.random() * -60;
    });
  }
  rainRAF = requestAnimationFrame(rainLoop);
}

function startRain() {
  if (rainRAF) return;
  resizeRain();
  rainRAF = requestAnimationFrame(rainLoop);
}
function stopRain() {
  if (rainRAF) { cancelAnimationFrame(rainRAF); rainRAF = null; }
}

// 故障闪烁：赛博模式下每 2.5~6.5 秒随机触发
(function glitchLoop() {
  setTimeout(() => {
    if (document.body.classList.contains('mode-cyber')) {
      segView.classList.add('glitching');
      setTimeout(() => segView.classList.remove('glitching'), 340);
    }
    glitchLoop();
  }, 2500 + Math.random() * 4000);
})();

/* ============================================================
   控制条 / 全屏 / 置顶 / 退出
   ============================================================ */
const controls = $('#controls');
let hideTimer = null;

function pokeControls() {
  controls.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => controls.classList.remove('show'), 3000);
}
window.addEventListener('mousemove', pokeControls);
window.addEventListener('mousedown', pokeControls);
window.addEventListener('keydown', pokeControls);
pokeControls();

/* ---- 全屏（窗口常驻无边框，全屏仅控制是否覆盖任务栏） ---- */
async function isFullScreen() {
  if (!HAS_NL) return !!document.fullscreenElement;
  try { return await Neutralino.window.isFullScreen(); } catch (e) { return false; }
}

async function enterFullScreen() {
  if (HAS_NL) {
    await Neutralino.window.setFullScreen();
    // 保险：确认边框已移除
    await Neutralino.window.setBorderless(true);
  } else {
    await document.documentElement.requestFullscreen();
  }
}

async function exitFullScreen() {
  if (HAS_NL) {
    await Neutralino.window.exitFullScreen();
    await Neutralino.window.setBorderless(true);
  } else {
    await document.exitFullscreen();
  }
}

async function toggleFullScreen() {
  if (await isFullScreen()) await exitFullScreen();
  else await enterFullScreen();
  setTimeout(updateFullBtn, 300);
}

let fsState = false; // 当前是否真全屏（拖拽逻辑用）

async function updateFullBtn() {
  fsState = await isFullScreen();
  $('#btnFull').classList.toggle('on', fsState);
}

/* ---- 无边框窗口拖拽：按住空白处即可移动窗口（全屏时忽略） ---- */
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || fsState) return;
  if (e.target.closest('#controls, #toast')) return;
  if (HAS_NL) Neutralino.window.beginDrag(e.screenX, e.screenY).catch(() => {});
});

window.addEventListener('dblclick', (e) => {
  if (e.target.closest('#controls')) return;
  toggleFullScreen();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') { e.preventDefault(); toggleFullScreen(); }
  if (e.key === 'Escape') {
    isFullScreen().then((fs) => { if (fs) exitFullScreen(); });
  }
});

$('#btnFull').addEventListener('click', toggleFullScreen);

$('#btnTop').addEventListener('click', () => {
  const btn = $('#btnTop');
  const on = !btn.classList.contains('on');
  btn.classList.toggle('on', on);
  if (HAS_NL) Neutralino.window.setAlwaysOnTop(on);
});

$('#btnExit').addEventListener('click', () => {
  if (HAS_NL) Neutralino.app.exit();
  else window.close();
});

/* ============================================================
   Toast 轻提示
   ============================================================ */
const toast = $('#toast');
let toastTimer = null;
function showToast(msg, ms = 2600) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

$('#btnUpdate').addEventListener('click', () => checkUpdate(true));

/* ============================================================
   版本更新检查
   ============================================================ */
async function checkUpdate(manual = true) {
  if (!UPDATE_URL) {
    if (manual) showToast(`当前版本 v${APP_VERSION} · 未配置更新源（UPDATE_URL）`);
    return;
  }
  if (manual) showToast('正在检查更新…');
  try {
    const res = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    const rv = String(data.version || '').trim();
    if (rv && rv !== APP_VERSION) {
      showToast(`发现新版本 v${rv}，正在打开下载地址…`);
      const dl = String(data.url || '');
      if (dl) {
        if (HAS_NL) Neutralino.os.open(dl);
        else window.open(dl, '_blank');
      }
    } else {
      if (manual) showToast(`已是最新版本 v${APP_VERSION}`);
    }
  } catch (e) {
    if (manual) showToast('检查更新失败：无法连接更新源');
  }
}

/* ============================================================
   托盘菜单：随电脑启动 / 检查更新 / 重新启动 / 退出
   ============================================================ */
let trayStartup = false;
let multiScreen = false; // 是否存在多显示器（决定「切换显示器」菜单项是否启用）

// 解析当前 exe 真实路径（改名后依然正确）
async function resolveExePath() {
  const np = String(window.NL_PATH || '');
  if (/^[A-Za-z]:\\.+\.exe$/i.test(np)) return np;
  try {
    const pid = await Neutralino.app.getProcessId();
    const r = await Neutralino.os.execCommand(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid}).Path"`);
    const p = (r.stdout || '').trim();
    if (p) return p;
  } catch (e) { /* ignore */ }
  return np;
}

async function isAutoStart() {
  if (!HAS_NL) return false;
  try {
    const r = await Neutralino.os.execCommand(`reg query "${RUN_KEY}" /v NixieClock`);
    return (r.stdout || '').includes('NixieClock');
  } catch (e) { return false; }
}

async function setAutoStart(on) {
  if (!HAS_NL) return;
  if (on) {
    const exe = await resolveExePath();
    await Neutralino.os.execCommand(
      `reg add "${RUN_KEY}" /v NixieClock /t REG_SZ /d "\\"${exe}\\"" /f`);
  } else {
    await Neutralino.os.execCommand(`reg delete "${RUN_KEY}" /v NixieClock /f`);
  }
}

// 查询所有显示器：[{primary, x, y, w, h}]
async function getScreens() {
  const r = await Neutralino.os.execCommand(SCREEN_PS);
  const out = [];
  (r.stdout || '').split(/\r?\n/).forEach(line => {
    const m = line.trim().match(/^(True|False)\|(-?\d+)\|(-?\d+)\|(\d+)\|(\d+)$/);
    if (m) out.push({ primary: m[1] === 'True', x: +m[2], y: +m[3], w: +m[4], h: +m[5] });
  });
  return out;
}

// 切换到下一块显示器：还原 → 移动 → 铺满该屏
async function switchMonitor() {
  if (!HAS_NL) return;
  const screens = await getScreens();
  if (screens.length < 2) { showToast('未检测到多显示器'); return; }
  const pos = await Neutralino.window.getPosition().catch(() => ({ x: 0, y: 0 }));
  const size = await Neutralino.window.getSize().catch(() => ({ width: 0, height: 0 }));
  const cx = (pos.x || 0) + (size.width || 0) / 2;
  const cy = (pos.y || 0) + (size.height || 0) / 2;
  let cur = screens.findIndex(s => cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h);
  if (cur < 0) cur = 0;
  const next = screens[(cur + 1) % screens.length];
  if (await Neutralino.window.isFullScreen().catch(() => false)) {
    await Neutralino.window.exitFullScreen().catch(() => {});
  }
  if (await Neutralino.window.isMaximized().catch(() => false)) {
    await Neutralino.window.unmaximize().catch(() => {});
  }
  await Neutralino.window.move(next.x, next.y).catch(() => {});
  await Neutralino.window.setSize({ width: next.w, height: next.h }).catch(() => {});
  await Neutralino.window.maximize().catch(() => {});
  showToast(`已切换到屏幕 ${((cur + 1) % screens.length) + 1}（${next.w}×${next.h}）`);
}

function buildTray() {
  if (!HAS_NL) return;
  const items = [
    { id: 'info', text: `NixieClock v${APP_VERSION}`, isDisabled: true },
  ];
  if (multiScreen) items.push({ id: 'switchMon', text: '切换显示器' });
  items.push(
    { id: 'startup', text: '随电脑启动', isChecked: trayStartup },
    { id: 'update', text: '检查更新' },
    { id: 'restart', text: '重新启动' },
    { id: 'exit', text: '退出' },
  );
  Neutralino.os.setTray({
    icon: '/resources/icons/appIcon.png',
    menuItems: items,
  }).catch(() => { /* 托盘不可用时忽略 */ });
}

if (HAS_NL) {
  Neutralino.events.on('trayMenuItemClicked', async (ev) => {
    const id = ev && ev.detail ? ev.detail.id : '';
    if (id === 'startup') {
      trayStartup = !trayStartup;
      try {
        await setAutoStart(trayStartup);
        showToast(trayStartup ? '已开启随电脑启动' : '已关闭随电脑启动');
      } catch (e) {
        trayStartup = !trayStartup;
        showToast('设置失败，请重试');
      }
      buildTray();
    } else if (id === 'switchMon') {
      switchMonitor().catch(() => showToast('切换显示器失败'));
    } else if (id === 'update') {
      checkUpdate(true);
    } else if (id === 'restart') {
      Neutralino.app.restartProcess();
    } else if (id === 'exit') {
      Neutralino.app.exit();
    }
  });

  Neutralino.events.on('ready', async () => {
    try { multiScreen = (await getScreens()).length > 1; } catch (e) { multiScreen = false; }
    trayStartup = await isAutoStart();
    buildTray();
  });
}

// 应用启动：恢复上次模式（放于末尾，避免引用尚未声明的雨效果变量）
setMode(saved, false);
updateFullBtn();

