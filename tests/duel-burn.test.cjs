const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = readFileSync(join(__dirname, '../dist/duel-burn.js'), 'utf8');

function harness({ webgl = true, reduced = false } = {}) {
  const pending = new Map(), uniforms = {}, draws = [];
  let frameId = 0, now = 0, contextLost = false, decode = () => Promise.resolve(), decodeCalls = 0;
  const events = () => ({ listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, emit(type, event = {}) { return this.listeners[type]?.(event); } });
  const gl = new Proxy({
    getShaderParameter: () => true, getProgramParameter: () => true, isContextLost: () => contextLost,
    getUniformLocation: (_, name) => name,
    uniform1i: (name, value) => { uniforms[name] = value; }, uniform1f: (name, value) => { uniforms[name] = value; },
    drawArrays: () => { draws.push({ ...uniforms }); },
  }, { get: (o, key) => key in o ? o[key] : () => ({}) });
  let imageColor;
  const ctx = {
    drawImage(img) { imageColor = img.color; },
    getImageData: (_, __, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(imageColor) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: result => draws.push({ cpu: true, firstPixel: result.data[0], lastPixel: result.data.at(-4) })
  };
  function makeCanvas() {
    return Object.assign(events(), { hidden: true, getContext: kind => kind === 'webgl' ? webgl ? gl : null : ctx,
      getBoundingClientRect: () => ({ width: 320, height: 400 }), cloneNode: makeCanvas,
      replaceWith(next) { canvas = next; } });
  }
  let canvas = makeCanvas();
  const images = [40, 120, 200].map((color, index) => ({
    naturalWidth: 1122, naturalHeight: 1402, color, hidden: index !== 0,
    dataset: { description: `Scene ${index + 1}` }, decode: () => { decodeCalls++; return decode(); }
  }));
  const hint = {}, status = {}, description = {};
  const figure = { querySelector: name => name === '.duel-status' ? status : description };
  const plate = Object.assign(events(), { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    closest: () => figure, querySelectorAll: name => name === '.duel-frame' ? images : [],
    querySelector: name => ({ '.duel-art': { getBoundingClientRect: () => ({ width: 320, height: 400, left: 0, top: 0 }) },
      canvas, '.duel-cue': hint })[name] });
  const document = Object.assign(events(), { hidden: false }), window = events(), media = Object.assign(events(), { matches: reduced });
  runInNewContext(source, { window, document, devicePixelRatio: 1, Float32Array, Math,
    requestAnimationFrame: fn => { pending.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => pending.delete(id) });
  const api = window.installDuelBurn({ root: { querySelector: () => plate }, reducedMotion: media, beforeActivate: () => true });
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const click = async () => { plate.emit('click', { detail: 1, clientX: 160, clientY: 200 }); await flush(); };
  const step = (delta = 16) => { now += delta; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); };
  const complete = () => { let guard = 0; while (pending.size && guard++ < 500) step(64); assert.ok(guard < 500); };
  return { api, plate, images, hint, status, description, draws, document, window, media, pending, click, step, complete, flush,
    getCanvas: () => canvas, getDecodeCalls: () => decodeCalls, setDecode: fn => { decode = fn; },
    loseContext: () => { contextLost = true; canvas.emit('webglcontextlost', { preventDefault() {} }); } };
}

function assertLabel(h) {
  assert.equal(h.plate.attributes['aria-label'], 'Нажмите на гравюру');
  assert.equal(h.hint.textContent, 'Нажмите на гравюру');
}
function assertSettled(h, index) {
  assert.equal(h.plate.dataset.burnFrame, String(index));
  assert.deepEqual(h.images.map(img => img.hidden), h.images.map((_, i) => i !== index));
  assert.equal(h.description.textContent, h.images[index].dataset.description);
  assert.equal(h.plate.attributes['aria-busy'], 'false');
  assert.equal(h.getCanvas().hidden, true);
  assert.equal(h.pending.size, 0);
  assertLabel(h);
}

test('every activation burns through 0→1→2→0 with matching GPU and static frames', async () => {
  const h = harness();
  for (let index = 0; index < 6; index++) {
    const from = index % 3, to = (from + 1) % 3;
    await h.click();
    assert.equal(h.plate.dataset.burnState, 'burning');
    assert.equal(h.plate.attributes['aria-busy'], 'true');
    assert.equal(h.plate.dataset.burnFrame, String(from));
    assert.equal(h.getCanvas().hidden, false);
    assert.equal(h.draws.at(-1).u_before, from);
    assert.equal(h.draws.at(-1).u_after, to);
    assertLabel(h);
    h.step(); h.step(700); // Long browser frame must not jump to completion.
    assert.ok(Number(h.plate.dataset.burnProgress) < .1);
    h.complete();
    assertSettled(h, to);
    assert.equal(h.draws.at(-1).u_progress, 1);
  }
});

test('rapid taps during decode or burn cannot skip a frame or reset progress', async () => {
  const h = harness(); let resolveDecode;
  const decoding = new Promise(resolve => { resolveDecode = resolve; }); h.setDecode(() => decoding);
  await h.click(); await h.click(); await h.click();
  assert.equal(h.getDecodeCalls(), 3);
  assert.equal(h.plate.dataset.burnState, 'loading'); assertLabel(h);
  resolveDecode(); await h.flush(); h.step(); h.step(32);
  const progress = h.plate.dataset.burnProgress;
  await h.click(); await h.click();
  assert.equal(h.plate.dataset.burnProgress, progress);
  assert.equal(h.plate.dataset.burnFrame, '0'); h.complete();
  assertSettled(h, 1);
});

test('resize and hidden-tab resume preserve progress while wrapping third to first', async () => {
  const h = harness();
  await h.click(); h.complete(); await h.click(); h.complete();
  await h.click(); h.step(); h.step(32);
  const progress = h.plate.dataset.burnProgress;
  h.api.resize(); assert.equal(h.plate.dataset.burnProgress, progress);
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.pending.size, 0); h.step(60000);
  assert.equal(h.plate.dataset.burnState, 'burning');
  h.document.hidden = false; h.document.emit('visibilitychange'); h.step();
  assert.equal(h.plate.dataset.burnProgress, progress); h.complete();
  assertSettled(h, 0);
});

test('navigation commits the correct DOM image for every transition before page cloning', async () => {
  const h = harness();
  for (const to of [1, 2, 0]) {
    await h.click(); h.step(); h.step(32); h.api.finish();
    assertSettled(h, to);
  }
});

test('decode cancellation on the third frame cannot restart after navigation', async () => {
  const h = harness(); await h.click(); h.complete(); await h.click(); h.complete();
  let resolveDecode;
  const decoding = new Promise(resolve => { resolveDecode = resolve; }); h.setDecode(() => decoding);
  await h.click(); assert.equal(h.plate.dataset.burnState, 'loading');
  h.api.finish(); resolveDecode(); await h.flush();
  assert.equal(h.plate.dataset.burnState, 'revealed');
  assertSettled(h, 2);
});

test('failed decode retains the third image and retries the burn to the first', async () => {
  const h = harness(); await h.click(); h.complete(); await h.click(); h.complete();
  h.setDecode(() => Promise.reject(new Error('network'))); await h.click();
  assertSettled(h, 2);
  h.setDecode(() => Promise.resolve()); await h.click();
  assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  assertSettled(h, 0);
});

test('reduced motion keeps a calm burn for the complete cycle', async () => {
  const h = harness({ reduced: true });
  for (const to of [1, 2, 0]) {
    await h.click();
    assert.equal(h.plate.dataset.burnState, 'burning');
    assert.equal(h.draws.at(-1).u_calm, 1);
    assert.equal(h.draws.at(-1).u_progress, 0);
    h.complete(); assertSettled(h, to);
  }
});

test('Canvas fallback burns all three distinct images, including the last-to-first wrap', async () => {
  const h = harness({ webgl: false, reduced: true });
  for (let from = 0; from < 3; from++) {
    const to = (from + 1) % 3;
    await h.click();
    assert.equal(h.plate.dataset.burnRenderer, 'canvas2d');
    assert.equal(h.plate.dataset.burnState, 'burning');
    assert.equal(h.draws.at(-1).firstPixel, h.images[from].color);
    assert.equal(h.draws.at(-1).lastPixel, h.images[from].color);
    h.complete();
    assert.equal(h.draws.at(-1).firstPixel, h.images[to].color);
    assert.equal(h.draws.at(-1).lastPixel, h.images[to].color);
    assertSettled(h, to);
  }
});

test('lost WebGL context preserves progress and the second-to-third destination', async () => {
  const h = harness({ reduced: true }); await h.click(); h.complete();
  await h.click(); h.step(); h.step(48);
  const progress = h.plate.dataset.burnProgress;
  h.loseContext(); assert.equal(h.plate.dataset.burnRenderer, 'canvas2d');
  assert.equal(h.plate.dataset.burnProgress, progress);
  assert.equal(h.plate.dataset.burnState, 'burning'); h.complete();
  assert.equal(h.draws.at(-1).firstPixel, h.images[2].color);
  assertSettled(h, 2);
});

test('dragging the engraving does not activate it, while keyboard activation burns', async () => {
  const h = harness();
  h.plate.emit('pointerdown', { isPrimary: true, button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  h.plate.emit('pointermove', { pointerId: 1, clientX: 120, clientY: 100 });
  h.plate.emit('pointerup', { pointerId: 1 });
  await h.click(); assert.equal(h.plate.dataset.burnState, 'ready');
  assert.equal(h.getDecodeCalls(), 0);
  h.plate.emit('click', { detail: 0 }); await h.flush();
  assert.equal(h.plate.dataset.burnState, 'burning');
  h.complete(); assertSettled(h, 1);
});
