const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../dist/duel-burn.js'), 'utf8');

function harness({ webgl = true, reduced = false } = {}) {
  const pending = new Map(), uniforms = {}, draws = [];
  let frameId = 0, now = 0, contextLost = false, decode = () => Promise.resolve();
  const events = () => ({ listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, emit(type, event = {}) { return this.listeners[type]?.(event); } });
  const gl = new Proxy({
    getShaderParameter: () => true, getProgramParameter: () => true, isContextLost: () => contextLost,
    getUniformLocation: (_, name) => name,
    uniform1i: (name, value) => { uniforms[name] = value; }, uniform1f: (name, value) => { uniforms[name] = value; },
    drawArrays: () => { draws.push({ ...uniforms }); },
  }, { get: (o, key) => key in o ? o[key] : () => ({}) });
  const ctx = { drawImage() {}, getImageData: (_, __, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(150) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => draws.push({ cpu: true }) };
  function makeCanvas() {
    return Object.assign(events(), { hidden: true, getContext: kind => kind === 'webgl' ? webgl ? gl : null : ctx,
      getBoundingClientRect: () => ({ width: 320, height: 400 }), cloneNode: makeCanvas,
      replaceWith(next) { canvas = next; } });
  }
  let canvas = makeCanvas();
  const images = [0, 1].map(() => ({ naturalWidth: 1122, naturalHeight: 1402, decode: () => decode() }));
  const hint = {}, status = {}, description = {};
  const figure = { querySelector: name => name === '.duel-status' ? status : description };
  const plate = Object.assign(events(), { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    closest: () => figure, querySelector: name => ({ '.duel-art': { getBoundingClientRect: () => ({ width: 320, height: 400, left: 0, top: 0 }) },
      '.duel-before': images[0], '.duel-after': images[1], canvas, '.duel-cue': hint })[name] });
  const document = Object.assign(events(), { hidden: false }), window = events(), media = Object.assign(events(), { matches: reduced });
  runInNewContext(source, { window, document, devicePixelRatio: 1, Float32Array, Math,
    requestAnimationFrame: fn => { pending.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => pending.delete(id) });
  const api = window.installDuelBurn({ root: { querySelector: () => plate }, reducedMotion: media, beforeActivate: () => true });
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const click = async () => { plate.emit('click', { detail: 1, clientX: 160, clientY: 200 }); await flush(); };
  const step = (delta = 16) => { now += delta; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); };
  const complete = () => { let guard = 0; while (pending.size && guard++ < 500) step(); assert.ok(guard < 500); };
  return { api, plate, draws, document, window, media, pending, click, step, complete, flush,
    getCanvas: () => canvas, setDecode: fn => { decode = fn; },
    loseContext: () => { contextLost = true; canvas.emit('webglcontextlost', { preventDefault() {} }); } };
}

test('every activation burns, swapping WebGL textures in both directions', async () => {
  const h = harness();
  for (let index = 0; index < 4; index++) {
    await h.click();
    assert.equal(h.plate.dataset.burnState, 'burning');
    assert.equal(h.plate.dataset.burnFrame, String(index % 2));
    assert.equal(h.draws.at(-1).u_before, index % 2);
    assert.equal(h.draws.at(-1).u_after, 1 - index % 2);
    h.step(); h.step(700); // Long browser frame must not jump to completion.
    assert.ok(Number(h.plate.dataset.burnProgress) < .1);
    h.complete();
    assert.equal(h.plate.dataset.burnFrame, String(1 - index % 2));
    assert.equal(h.getCanvas().hidden, true);
  }
});

test('rapid extra taps cannot settle or reset the in-flight burn', async () => {
  const h = harness(); await h.click(); h.step(); h.step(32);
  const progress = h.plate.dataset.burnProgress;
  await h.click(); await h.click();
  assert.equal(h.plate.dataset.burnProgress, progress);
  assert.equal(h.plate.dataset.burnFrame, '0'); h.complete();
  assert.equal(h.plate.dataset.burnFrame, '1');
});

test('resize and hidden-tab resume preserve progress and current frame', async () => {
  const h = harness(); await h.click(); h.step(); h.step(32);
  const progress = h.plate.dataset.burnProgress;
  h.api.resize(); assert.equal(h.plate.dataset.burnProgress, progress);
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.pending.size, 0); h.step(60000);
  assert.equal(h.plate.dataset.burnState, 'burning');
  h.document.hidden = false; h.document.emit('visibilitychange'); h.step();
  assert.equal(h.plate.dataset.burnProgress, progress); h.complete();
});

test('navigation settles the correct destination when burning in reverse', async () => {
  const h = harness(); await h.click(); h.complete(); await h.click(); h.api.finish();
  assert.equal(h.plate.dataset.burnFrame, '0'); assert.equal(h.pending.size, 0);
});

test('decode cancellation cannot restart an effect after navigation', async () => {
  const h = harness(); let resolveDecode;
  // One shared promise ensures both image decodes resolve together.
  const decoding = new Promise(resolve => { resolveDecode = resolve; }); h.setDecode(() => decoding);
  await h.click(); assert.equal(h.plate.dataset.burnState, 'loading');
  h.api.finish(); resolveDecode(); await h.flush();
  assert.equal(h.plate.dataset.burnState, 'ready'); assert.equal(h.pending.size, 0);
});

test('failed decode retains the current (including second) image and permits retry', async () => {
  const h = harness(); await h.click(); h.complete();
  h.setDecode(() => Promise.reject(new Error('network'))); await h.click();
  assert.equal(h.plate.dataset.burnFrame, '1'); assert.equal(h.pending.size, 0);
  h.setDecode(() => Promise.resolve()); await h.click();
  assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  assert.equal(h.plate.dataset.burnFrame, '0');
});

test('reduced motion still uses a calm burn, never an immediate image swap', async () => {
  const h = harness({ reduced: true }); await h.click();
  assert.equal(h.plate.dataset.burnState, 'burning'); assert.equal(h.draws.at(-1).u_calm, 1);
  h.complete(); await h.click(); assert.equal(h.plate.dataset.burnState, 'burning');
});

test('no WebGL uses the paper-burn renderer in both directions', async () => {
  const h = harness({ webgl: false, reduced: true });
  await h.click(); assert.equal(h.plate.dataset.burnRenderer, 'canvas2d');
  assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  await h.click(); assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  assert.equal(h.plate.dataset.burnFrame, '0');
});

test('lost WebGL context continues the burn from its current progress', async () => {
  const h = harness({ reduced: true }); await h.click(); h.step(); h.step(48);
  const progress = h.plate.dataset.burnProgress;
  h.loseContext(); assert.equal(h.plate.dataset.burnRenderer, 'canvas2d');
  assert.equal(h.plate.dataset.burnProgress, progress);
  assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  assert.equal(h.plate.dataset.burnFrame, '1');
});
