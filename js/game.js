// 摘石榴 picking-typing
// 石榴亮起黄光，按下它身上的字母，石榴进篮子。摘光、篮子满，这一局成功。
// 先练 F J，再慢慢把手指加上去。

const LEVELS = [
  {
    name: "食指回家",
    letters: ["F", "J"],
    count: 6,
    alternate: true,
    hint: "左手食指按 F，右手食指按 J",
  },
  {
    name: "再摘一把",
    letters: ["F", "J"],
    count: 8,
    alternate: true,
    hint: "F 用左手，J 用右手，手不要挪开",
  },
  {
    name: "中指来帮忙",
    letters: ["D", "F", "J", "K"],
    count: 8,
    emphasize: ["D", "K"],
    hint: "D 用左手中指，K 用右手中指",
  },
  {
    name: "无名指",
    letters: ["S", "D", "F", "J", "K", "L"],
    count: 8,
    emphasize: ["S", "L"],
    hint: "S 用左手无名指，L 用右手无名指",
  },
  {
    name: "小指你好",
    letters: ["A", "S", "D", "F", "J", "K", "L"],
    count: 10,
    emphasize: ["A"],
    hint: "A 用左手小指",
  },
  {
    name: "往中间够",
    letters: ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    count: 10,
    emphasize: ["G", "H"],
    hint: "G 和 H 还是用食指，往中间够一点",
  },
  {
    name: "往上够",
    letters: ["F", "J", "R", "T", "Y", "U"],
    count: 8,
    emphasize: ["R", "T", "Y", "U"],
    hint: "食指往上：R T 左手，Y U 右手",
  },
  {
    name: "满满一篮",
    letters: ["A", "S", "D", "F", "G", "H", "J", "K", "L", "R", "U"],
    count: 12,
    hint: "黄光亮到哪颗，就按哪颗",
  },
];

const SLOTS = [
  { x: 18, y: 16 },
  { x: 38, y: 16 },
  { x: 58, y: 16 },
  { x: 78, y: 16 },
  { x: 23, y: 34 },
  { x: 43, y: 34 },
  { x: 63, y: 34 },
  { x: 83, y: 34 },
  { x: 18, y: 52 },
  { x: 38, y: 52 },
  { x: 58, y: 52 },
  { x: 78, y: 52 },
];

const PLANS = {
  6: [1, 4, 6, 8, 10, 11],
  8: [0, 3, 5, 7, 9, 11, 2, 6],
  10: [0, 1, 3, 4, 5, 6, 7, 8, 9, 11],
  12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const HOME = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
const UPPER = [
  { letter: "R", col: 4 },
  { letter: "T", col: 5 },
  { letter: "Y", col: 6 },
  { letter: "U", col: 7 },
];

const BASKET_X = 68;
const PLIES = {
  6: [3, 2, 1],
  8: [3, 3, 2],
  10: [3, 4, 3],
  12: [3, 4, 3, 2],
};
const MUTE_KEY = "picking-typing-muted";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function readMutePreference() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMutePreference() {
  try {
    window.localStorage.setItem(MUTE_KEY, state.muted ? "1" : "0");
  } catch {
    // Sound still works for this visit when the browser cannot save settings.
  }
}

const state = {
  phase: "intro",
  levelIndex: 0,
  fruits: [],
  mistakes: 0,
  activeId: null,
  lock: true,
  token: 0,
  muted: readMutePreference(),
};

const fruitsEl = document.getElementById("fruits");
const kickerEl = document.getElementById("kicker");
const messageEl = document.getElementById("message");
const detailEl = document.getElementById("detail");
const actionsEl = document.getElementById("actions");
const keysEl = document.getElementById("keys");
const pipsEl = document.getElementById("pips");
const countEl = document.getElementById("count");
const muteEl = document.getElementById("mute");
const basketEl = document.getElementById("basket");

let audioCtx = null;
let flashTimer = 0;

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deal(level) {
  if (level.alternate) {
    const pair = Math.random() < 0.5 ? level.letters : [level.letters[1], level.letters[0]];
    return Array.from({ length: level.count }, (_, i) => pair[i % 2]);
  }

  const out = [];
  if (level.letters.length >= level.count) {
    return shuffle(level.letters).slice(0, level.count);
  }
  out.push(...level.letters);
  (level.emphasize || []).forEach((letter) => {
    if (out.length < level.count) out.push(letter);
  });
  const pool = level.letters.concat(level.emphasize || []);
  while (out.length < level.count) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  const mixed = shuffle(out);
  for (let i = 2; i < mixed.length; i += 1) {
    if (mixed[i] === mixed[i - 1] && mixed[i] === mixed[i - 2]) {
      const j = mixed.findIndex((letter, idx) => idx > i && letter !== mixed[i]);
      if (j !== -1) [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }
  }

  const focus = level.emphasize || [];
  if (focus.length && !focus.includes(mixed[0])) {
    const j = mixed.findIndex((letter) => focus.includes(letter));
    if (j > 0) [mixed[0], mixed[j]] = [mixed[j], mixed[0]];
  }
  return mixed;
}

function slotsFor(count) {
  const plan = PLANS[count] || SLOTS.map((_, i) => i).slice(0, count);
  return plan.map((index) => SLOTS[index]);
}

function basketPoint(index, total) {
  const rows = PLIES[total] || [Math.min(3, total)];
  let cursor = index;
  let row = 0;
  while (row < rows.length - 1 && cursor >= rows[row]) {
    cursor -= rows[row];
    row += 1;
  }
  const count = rows[row] || 1;
  // All fruit keep their 14.2%-wide size; overlap makes a settled pile.
  // These coordinates use the paper's 1000 × 760 drawing space.
  const spacing = 12;
  const rowWidth = (count - 1) * spacing;
  return {
    x: BASKET_X - rowWidth / 2 + cursor * spacing,
    y: 87 - row * 9,
    row,
    scale: 1,
  };
}

function fruitMarkup(color, index) {
  const id = `pom-${state.token}-${index}`;
  const skins = [
    ["#f57a52", "#d33330", "#982c2a"],
    ["#ed6a46", "#c72d2c", "#8e2828"],
    ["#f58053", "#d94135", "#a22d29"],
    ["#ec704a", "#c9342b", "#972921"],
  ][color];
  return `
    <span class="halo"></span>
    <span class="sway">
      <svg viewBox="0 0 100 112" class="pom pom-${color}" aria-hidden="true">
        <defs>
          <radialGradient id="${id}-skin" cx="31%" cy="24%" r="83%">
            <stop offset="0" stop-color="${skins[0]}"/>
            <stop offset=".48" stop-color="${skins[1]}"/>
            <stop offset="1" stop-color="${skins[2]}"/>
          </radialGradient>
          <radialGradient id="${id}-light">
            <stop stop-color="#ffe8b4" stop-opacity=".5"/>
            <stop offset="1" stop-color="#ffe8b4" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <path class="calyx" style="fill:#813b29" stroke="#6d3025" stroke-width="1.1" d="M38 35 34 22 43 26 46 14 52 23 60 15 61 28 71 24 65 38 Q51 45 38 35Z"/>
        <path fill="none" stroke="#b2603a" stroke-width="1.2" d="m43 27 4 9m6-11 1 11m8-6-3 7"/>
        <path class="body" style="fill:url(#${id}-skin)" stroke="#9d332c" stroke-width=".8" d="M49 31C65 26 81 34 88 51 96 71 89 90 71 99 59 106 42 105 29 100 11 94 5 78 10 59 14 42 30 28 43 31 45 32 47 32 49 31Z"/>
        <ellipse class="shine" style="fill:url(#${id}-light)" cx="32" cy="48" rx="15" ry="17"/>
        <path fill="none" stroke="#ffd49b" stroke-opacity=".43" stroke-width="1.5" stroke-linecap="round" d="M22 53q2-9 9-13"/>
        <g fill="#f5bc72" opacity=".55">
          <circle cx="22" cy="64" r=".65"/><circle cx="29" cy="52" r=".65"/>
          <circle cx="37" cy="39" r=".6"/><circle cx="65" cy="44" r=".75"/>
          <circle cx="76" cy="52" r=".55"/><circle cx="81" cy="69" r=".75"/>
          <circle cx="73" cy="84" r=".7"/><circle cx="60" cy="94" r=".6"/>
          <circle cx="44" cy="95" r=".8"/><circle cx="28" cy="88" r=".65"/>
          <circle cx="17" cy="75" r=".55"/><circle cx="36" cy="82" r=".55"/>
        </g>
      </svg>
      <span class="letter"></span>
    </span>`;
}

function spawn(level) {
  fruitsEl.replaceChildren();
  const letters = deal(level);
  const slots = shuffle(slotsFor(level.count));
  state.fruits = letters.map((letter, index) => {
    const slot = slots[index];
    const fruit = {
      id: index,
      letter,
      x: slot.x,
      y: slot.y,
      picked: false,
      landed: false,
      el: null,
    };
    const el = document.createElement("button");
    el.type = "button";
    el.className = "fruit";
    el.tabIndex = -1;
    el.style.left = `${slot.x}%`;
    el.style.top = `${slot.y}%`;
    el.setAttribute("aria-label", `石榴 ${letter}`);
    el.innerHTML = fruitMarkup(index % 4, index);
    el.querySelector(".letter").textContent = letter;
    el.querySelector(".sway").style.animationDelay = `${-index * 0.27}s`;
    el.addEventListener("click", () => onFruitClick(fruit));
    fruitsEl.appendChild(el);
    fruit.el = el;
    return fruit;
  });
}

function updateCount() {
  const picked = state.fruits.filter((fruit) => fruit.landed).length;
  const total = state.fruits.length;
  countEl.textContent = `${picked}/${total}`;
}

function renderPips() {
  pipsEl.replaceChildren();
  LEVELS.forEach((level, index) => {
    const pip = document.createElement("i");
    pip.className = "pip";
    const finished = index < state.levelIndex || (state.phase === "win" && index === state.levelIndex);
    const current = index === state.levelIndex && !finished;
    pip.classList.toggle("done", finished);
    pip.classList.toggle("on", current);
    pip.title = level.name;
    pipsEl.appendChild(pip);
  });
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderPanel() {
  const level = LEVELS[state.levelIndex];
  document.body.dataset.phase = state.phase;
  actionsEl.replaceChildren();
  detailEl.classList.remove("stars");
  messageEl.classList.remove("warn");

  if (state.phase === "intro") {
    kickerEl.textContent = "准备好了吗";
    messageEl.textContent = "石榴亮起黄光，就按下上面的字母。";
    detailEl.textContent = "也可以点它。石榴会掉进篮子，摘光了就成功。";
    actionsEl.appendChild(makeButton("开始摘石榴", "primary", begin));
    return;
  }

  if (state.phase === "win") {
    const last = state.levelIndex === LEVELS.length - 1;
    const stars = state.mistakes === 0 ? 3 : state.mistakes <= 2 ? 2 : 1;
    const note = state.mistakes === 0
      ? "一个都没按错"
      : state.mistakes === 1
        ? "只错了一次"
        : `错了 ${state.mistakes} 次，手还在学`;
    kickerEl.textContent = last ? "八局都成功啦" : `第 ${state.levelIndex + 1} 局成功`;
    messageEl.textContent = last ? "树摘空了，篮子满满的" : "摘光啦，篮子满了";
    detailEl.classList.add("stars");
    detailEl.textContent = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}  ${note}`;
    if (last) {
      actionsEl.appendChild(makeButton("再从第一局开始", "primary", () => startLevel(0)));
    } else {
      actionsEl.appendChild(makeButton("下一局", "primary", () => startLevel(state.levelIndex + 1)));
    }
    actionsEl.appendChild(makeButton("再摘一次", "ghost", () => startLevel(state.levelIndex)));
    return;
  }

  kickerEl.textContent = `第 ${state.levelIndex + 1} 局 · ${level.name}`;
  messageEl.textContent = level.hint;
  detailEl.textContent = state.levelIndex === 0 ? "也可以直接点那颗亮着的石榴" : "亮了就按";
}

function renderKeys() {
  const letters = new Set(LEVELS[state.levelIndex].letters);
  const upperNeeded = UPPER.some((item) => letters.has(item.letter));
  keysEl.replaceChildren();
  keysEl.classList.toggle("live", state.phase === "playing");

  if (upperNeeded) {
    const upper = document.createElement("div");
    upper.className = "keys-row";
    UPPER.forEach((item) => {
      const key = createKey(item.letter, letters.has(item.letter));
      key.style.gridColumn = String(item.col);
      upper.appendChild(key);
    });
    keysEl.appendChild(upper);
  }

  const home = document.createElement("div");
  home.className = "keys-row";
  HOME.forEach((letter) => home.appendChild(createKey(letter, letters.has(letter))));
  keysEl.appendChild(home);
  highlightKey(activeLetter());
}

function createKey(letter, enabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = enabled ? "key" : "key off";
  button.dataset.letter = letter;
  button.textContent = letter;
  button.setAttribute("aria-label", `字母 ${letter}`);
  if (letter === "F" || letter === "J") {
    const bump = document.createElement("i");
    bump.className = "bump";
    button.appendChild(bump);
  }
  button.addEventListener("click", () => {
    if (!enabled || state.phase !== "playing") return;
    pressKey(letter);
    submit(letter);
  });
  return button;
}

function activeLetter() {
  const fruit = state.fruits.find((item) => item.id === state.activeId && !item.picked);
  return fruit ? fruit.letter : null;
}

function highlightKey(letter) {
  keysEl.querySelectorAll(".key").forEach((key) => {
    key.classList.toggle("glow", Boolean(letter) && key.dataset.letter === letter && !key.classList.contains("off"));
  });
}

function pressKey(letter) {
  const key = keysEl.querySelector(`.key[data-letter="${letter}"]:not(.off)`);
  if (!key) return;
  key.classList.add("down");
  window.setTimeout(() => key.classList.remove("down"), 120);
}

function flash(text) {
  messageEl.textContent = text;
  messageEl.classList.add("warn");
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    messageEl.classList.remove("warn");
    if (state.phase === "playing") messageEl.textContent = LEVELS[state.levelIndex].hint;
  }, 700);
}

function activate(fruit, sound) {
  state.activeId = fruit.id;
  state.fruits.forEach((item) => {
    item.el.classList.toggle("active", item.id === fruit.id);
  });
  highlightKey(fruit.letter);
  if (sound) playGlow();
}

function clearActive() {
  state.activeId = null;
  state.fruits.forEach((item) => item.el.classList.remove("active"));
  highlightKey(null);
}

function startLevel(index, preview) {
  state.token += 1;
  const token = state.token;
  state.levelIndex = index;
  state.phase = preview ? "intro" : "playing";
  state.mistakes = 0;
  state.lock = true;
  basketEl.classList.remove("joy");
  spawn(LEVELS[index]);
  updateCount();
  renderPanel();
  renderPips();
  renderKeys();

  if (preview) {
    activate(state.fruits[0], false);
    return;
  }

  clearActive();
  window.setTimeout(() => {
    if (token !== state.token || state.phase !== "playing") return;
    state.lock = false;
    activate(state.fruits[0], true);
  }, reduceMotion ? 0 : 560);
}

function begin() {
  if (state.phase !== "intro") return;
  audio();
  startLevel(state.levelIndex, false);
}

function submit(letter) {
  if (state.phase !== "playing") return;
  if (state.lock || state.activeId === null) return;
  const fruit = state.fruits.find((item) => item.id === state.activeId);
  if (!fruit || fruit.picked) return;
  if (letter === fruit.letter) {
    succeed(fruit);
    return;
  }
  state.mistakes += 1;
  shake(fruit);
  playWrong();
  flash("是这颗亮着的");
}

function onFruitClick(fruit) {
  if (state.phase !== "playing" || state.lock || fruit.picked) return;
  if (fruit.id !== state.activeId) {
    state.mistakes += 1;
    shake(fruit);
    playWrong();
    flash("等它亮起黄光");
    return;
  }
  succeed(fruit);
}

async function succeed(fruit) {
  const token = state.token;
  fruit.picked = true;
  fruit.el.classList.remove("active");
  state.activeId = null;
  state.lock = true;
  highlightKey(null);
  const landing = basketPoint(
    state.fruits.filter((item) => item.picked).length - 1,
    state.fruits.length
  );
  playPick();
  const landed = await drop(fruit, landing);
  if (!landed || token !== state.token || state.phase !== "playing") return;
  fruit.landed = true;
  updateCount();
  const next = state.fruits.find((item) => !item.picked);
  if (!next) {
    win();
    return;
  }
  state.lock = false;
  activate(next, true);
}

async function drop(fruit, landing) {
  const el = fruit.el;
  el.classList.add("flying");
  el.disabled = true;
  el.style.zIndex = "32";
  const midX = fruit.x + (landing.x - fruit.x) * 0.72;
  const midY = fruit.y + (landing.y - fruit.y) * 0.38;
  if (!reduceMotion && typeof el.animate === "function") {
    const animation = el.animate(
      [
        { left: `${fruit.x}%`, top: `${fruit.y}%`, transform: "translate(-50%, -50%) scale(1)" },
        { left: `${midX}%`, top: `${midY}%`, transform: "translate(-50%, -50%) scale(1)", offset: 0.55 },
        { left: `${landing.x}%`, top: `${landing.y}%`, transform: "translate(-50%, -50%) scale(1)" },
      ],
      { duration: 760, easing: "cubic-bezier(.36,.04,.68,1)", fill: "forwards" }
    );
    try {
      await animation.finished;
    } catch {
      return false;
    }
    el.style.left = `${landing.x}%`;
    el.style.top = `${landing.y}%`;
    // Keep the resting position in normal styles, without a permanent animation.
    animation.cancel();
  } else {
    el.style.left = `${landing.x}%`;
    el.style.top = `${landing.y}%`;
  }
  fruit.x = landing.x;
  fruit.y = landing.y;
  el.classList.remove("flying");
  el.classList.add("in-basket");
  el.style.zIndex = String(30 + landing.row);
  el.setAttribute("aria-label", `石榴 ${fruit.letter}，已放进篮子`);
  return true;
}

function shake(fruit) {
  fruit.el.classList.remove("shake");
  void fruit.el.offsetWidth;
  fruit.el.classList.add("shake");
  window.setTimeout(() => fruit.el.classList.remove("shake"), 380);
}

function win() {
  if (state.phase === "win") return;
  state.phase = "win";
  state.lock = true;
  state.activeId = null;
  highlightKey(null);
  basketEl.classList.add("joy");
  playWin();
  renderPanel();
  renderPips();
  keysEl.classList.remove("live");
}

function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || event.isComposing || event.keyCode === 229) return;
  const target = event.target;
  if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "")) return;

  if (event.code === "Enter") {
    // Let a focused button keep its native Enter action (including “replay”).
    if (target?.closest?.("button, a[href], [role='button']")) return;
    if (state.phase === "playing") return;
    event.preventDefault();
    if (state.phase === "intro") begin();
    else if (state.phase === "win") {
      const last = state.levelIndex === LEVELS.length - 1;
      startLevel(last ? 0 : state.levelIndex + 1);
    }
    return;
  }

  if (event.code === "Space") {
    if (event.target === document.body) event.preventDefault();
    return;
  }

  const letter = letterFromEvent(event);
  if (!letter || state.phase !== "playing") return;
  event.preventDefault();
  pressKey(letter);
  submit(letter);
}

function letterFromEvent(event) {
  if (event.code && event.code.startsWith("Key") && event.code.length === 4) {
    return event.code.slice(3);
  }
  if (event.key && /^[a-zA-Z]$/.test(event.key)) return event.key.toUpperCase();
  return null;
}

function audio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, when, duration, type, gain) {
  const ctx = audio();
  if (!ctx || state.muted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  amp.gain.setValueAtTime(gain, when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration);
}

function playGlow() {
  const ctx = audio();
  if (!ctx || state.muted || state.phase !== "playing") return;
  tone(698, ctx.currentTime, 0.08, "sine", 0.025);
}

function playPick() {
  const ctx = audio();
  if (!ctx || state.muted) return;
  const now = ctx.currentTime;
  tone(523, now, 0.12, "triangle", 0.05);
  tone(784, now + 0.07, 0.16, "triangle", 0.045);
}

function playWrong() {
  const ctx = audio();
  if (!ctx || state.muted) return;
  tone(180, ctx.currentTime, 0.12, "sine", 0.03);
}

function playWin() {
  const ctx = audio();
  if (!ctx || state.muted) return;
  const now = ctx.currentTime;
  [523, 659, 784, 1046].forEach((freq, index) => {
    tone(freq, now + index * 0.11, 0.22, "triangle", 0.05);
  });
}

function soundIcon(muted) {
  if (muted) {
    return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 9h3.5L13 4.5v15L7.5 15H4V9z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 9h3.5L13 4.5v15L7.5 15H4V9z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9.2a3.2 3.2 0 0 1 0 5.6M18.3 7a6 6 0 0 1 0 10"/></svg>`;
}

function renderMute() {
  muteEl.innerHTML = soundIcon(state.muted);
  muteEl.setAttribute("aria-label", state.muted ? "打开声音" : "关闭声音");
}

muteEl.addEventListener("click", () => {
  state.muted = !state.muted;
  saveMutePreference();
  renderMute();
  if (!state.muted) {
    audio();
    playPick();
  }
});

window.addEventListener("keydown", onKeyDown);
renderMute();
startLevel(0, true);
