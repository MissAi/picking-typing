import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../js/game.js", import.meta.url), "utf8");

// Exercise the real game with controllable animation completion, without waiting
// for timers or duplicating its geometry or state transitions in the tests.
function loadGame({ reducedMotion = false, blockedStorage = false } = {}) {
  const animations = [];
  class Element {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.style = {};
      this.dataset = {};
      this.className = "";
      this.attributes = {};
      this.parts = {};
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name) || this.className.split(" ").includes(name),
        toggle: (name, enabled) => {
          const show = enabled ?? !classes.has(name);
          if (show) classes.add(name);
          else classes.delete(name);
          return show;
        },
      };
    }
    replaceChildren(...children) { this.children = children; }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener() {}
    querySelector(selector) {
      return this.parts[selector] ||= new Element();
    }
    querySelectorAll() {
      return this.children.flatMap((child) => [child, ...child.querySelectorAll()])
        .filter((child) => child.dataset.letter);
    }
    animate(frames, options) {
      let finish;
      let reject;
      const animation = {
        frames,
        options,
        finished: new Promise((resolve, rejectPromise) => { finish = resolve; reject = rejectPromise; }),
        finish: () => finish(),
        cancel: () => reject(new Error("Animation canceled")),
      };
      animations.push(animation);
      return animation;
    }
  }
  const elements = new Map();
  const document = {
    body: new Element("body"),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
  };
  const window = {
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: () => 1,
    clearTimeout() {},
    localStorage: {
      getItem() { if (blockedStorage) throw new Error("Storage unavailable"); return null; },
      setItem() { if (blockedStorage) throw new Error("Storage unavailable"); },
    },
  };
  const context = vm.createContext({ window, document, console });
  const definitions = source.slice(0, source.indexOf('muteEl.addEventListener("click"'));
  vm.runInContext(`${definitions}\nglobalThis.game = { LEVELS, SLOTS, state, deal, slotsFor, basketPoint, startLevel, activate, succeed, submit, onKeyDown, saveMutePreference };`, context);
  return { ...context.game, animations, elements, document };
}

function start(game, index = 0) {
  game.startLevel(index);
  game.state.lock = false;
  game.activate(game.state.fruits[0], false);
}

test("tree layouts keep readable gaps and every same-size basket placement fits", () => {
  const game = loadGame();
  const maxTreeY = Math.max(...game.SLOTS.map((slot) => slot.y));
  for (const level of game.LEVELS) {
    const slots = game.slotsFor(level.count);
    assert.equal(slots.length, level.count);
    assert.equal(new Set(slots.map(({ x, y }) => `${x},${y}`)).size, level.count);
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const dx = Math.abs(slots[i].x - slots[j].x);
        const dy = Math.abs(slots[i].y - slots[j].y);
        assert.ok(dx >= 12 || dy >= 18, "fruit labels need a readable gap");
      }
      const landing = game.basketPoint(i, level.count);
      assert.equal(landing.scale, 1);
      assert.ok(landing.y > maxTreeY, "even the top of the pile must be below every starting fruit");
      // The painted fruit body occupies x=8..92 in its 100-unit SVG.
      const bodyHalfWidth = 14.2 * 0.42;
      assert.ok(landing.x - bodyHalfWidth >= 44);
      assert.ok(landing.x + bodyHalfWidth <= 92);
      if (landing.row === 0) {
        assert.ok(landing.x - bodyHalfWidth >= 49, "bottom-row fruit must fit inside the basket's narrower base");
        assert.ok(landing.x + bodyHalfWidth <= 87, "bottom-row fruit must not protrude beside the basket base");
      }
      const spriteHalfHeight = (14.2 * 1.12 * 1000 / 760) / 2;
      assert.ok(landing.y + spriteHalfHeight < 98.5, "no fruit may protrude below the basket");
    }
  }
});

test("all eight lessons finish only when the last whole fruit has landed", async () => {
  const game = loadGame();
  for (let level = 0; level < game.LEVELS.length; level += 1) {
    start(game, level);
    const total = game.state.fruits.length;
    for (let index = 0; index < total; index += 1) {
      const fruit = game.state.fruits[index];
      const complete = game.succeed(fruit);
      assert.equal(game.state.phase, "playing");
      assert.equal(game.state.lock, true);
      assert.equal(game.state.activeId, null);
      assert.equal(game.elements.get("count").textContent, `${index}/${total}`);
      game.submit("X");
      const animation = game.animations.at(-1);
      const tops = animation.frames.map((frame) => Number.parseFloat(frame.top));
      assert.ok(tops.every((value, i) => i === 0 || value >= tops[i - 1]), "a picked fruit only falls downward");
      assert.ok(animation.frames.every((frame) => frame.transform.endsWith("scale(1)")), "falling fruit never shrink");
      animation.finish();
      await complete;
      assert.equal(fruit.landed, true);
      assert.equal(game.elements.get("count").textContent, `${index + 1}/${total}`);
      assert.equal(game.state.mistakes, 0, "typing during a fall must not queue a mistake");
      if (index < total - 1) {
        assert.equal(game.state.phase, "playing");
        assert.equal(game.state.activeId, index + 1);
        assert.equal(game.state.lock, false);
      }
    }
    assert.equal(game.state.phase, "win");
    assert.ok(game.state.fruits.every((fruit) => fruit.landed && fruit.el.classList.contains("in-basket")));
  }
});

test("an old animation cannot advance a restarted lesson", async () => {
  const game = loadGame();
  start(game);
  const complete = game.succeed(game.state.fruits[0]);
  const oldAnimation = game.animations.at(-1);
  game.startLevel(1);
  oldAnimation.finish();
  await complete;
  assert.equal(game.state.levelIndex, 1);
  assert.equal(game.state.activeId, null);
  assert.equal(game.state.lock, true);
  assert.ok(game.state.fruits.every((fruit) => !fruit.landed));
});

test("reduced motion completes the same basket without an animation dependency", async () => {
  const game = loadGame({ reducedMotion: true });
  start(game);
  for (const fruit of game.state.fruits) await game.succeed(fruit);
  assert.equal(game.state.phase, "win");
  assert.equal(game.animations.length, 0);
});

test("blocked storage does not prevent starting or changing sound", () => {
  const game = loadGame({ blockedStorage: true });
  assert.equal(game.state.muted, false);
  game.state.muted = true;
  assert.doesNotThrow(() => game.saveMutePreference());
  assert.doesNotThrow(() => start(game));
});

test("keyboard ignores composition, key repeats and editable fields; Enter respects focused controls", () => {
  const game = loadGame();
  start(game);
  const event = (changes) => ({ code: "KeyX", key: "x", target: game.document.body, preventDefault() { throw new Error("An ignored key must not be intercepted"); }, ...changes });
  game.onKeyDown(event({ isComposing: true }));
  game.onKeyDown(event({ keyCode: 229 }));
  game.onKeyDown(event({ repeat: true }));
  game.onKeyDown(event({ target: { tagName: "INPUT" } }));
  game.onKeyDown(event({ target: { isContentEditable: true } }));
  assert.equal(game.state.mistakes, 0);
  game.state.phase = "win";
  game.onKeyDown(event({ code: "Enter", target: { closest: () => ({ tagName: "BUTTON" }) } }));
  game.onKeyDown(event({ code: "Enter", repeat: true }));
  assert.equal(game.state.phase, "win");
  assert.equal(game.state.levelIndex, 0);
});

test("dealing preserves each lesson's letters and alternates F and J", () => {
  const game = loadGame();
  for (const level of game.LEVELS) {
    for (let round = 0; round < 30; round += 1) {
      const letters = game.deal(level);
      assert.equal(letters.length, level.count);
      for (const letter of level.letters) assert.ok(letters.includes(letter));
      if (level.alternate) assert.ok(letters.every((letter, index) => index === 0 || letter !== letters[index - 1]));
    }
  }
});
