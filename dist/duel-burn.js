/* Browser implementation inspired by Miskatonic Studio's burning-paper study:
 * https://github.com/miskatonicstudio/godot-experiments/tree/master/shaders/burning_paper
 * Independently written GLSL: a static noise field, char band and ember edge.
 * Only the engraving burns; the mounted plate and page remain untouched.
 */
(() => {
  'use strict';
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_before;
    uniform sampler2D u_after;
    uniform vec2 u_origin;
    uniform float u_aspect;
    uniform float u_reach;
    uniform float u_progress;
    uniform float u_time;
    uniform float u_calm;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
    }
    float paperNoise(vec2 p) {
      float value = 0.0;
      float weight = 0.53;
      for (int i = 0; i < 5; i++) {
        value += weight * noise(p);
        p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 9.7;
        weight *= 0.48;
      }
      return value;
    }
    void main() {
      vec3 before = texture2D(u_before, v_uv).rgb;
      vec3 after = texture2D(u_after, v_uv).rgb;
      if (u_progress <= 0.0) { gl_FragColor = vec4(before, 1.0); return; }
      if (u_progress >= 1.0) { gl_FragColor = vec4(after, 1.0); return; }

      vec2 p = v_uv * vec2(u_aspect, 1.0);
      vec2 origin = u_origin * vec2(u_aspect, 1.0);
      // The paper's irregularities are fixed in place. Only the front advances.
      float grain = paperNoise(p * 8.5);
      float distanceField = length(p - origin) + (grain - 0.5) * 0.24
                          + (noise(p * 130.0) - 0.5) * 0.007;
      float front = mix(-0.13, u_reach + 0.17, pow(u_progress, 0.88));
      float edge = distanceField - front;
      float intact = smoothstep(-0.002, 0.002, edge);
      float scorch = 1.0 - smoothstep(0.016, 0.072, edge);
      float charBand = 1.0 - smoothstep(0.003, 0.031, edge);
      vec3 browned = before * vec3(0.49, 0.31, 0.17);
      vec3 paper = mix(before, browned, scorch * 0.88);
      paper = mix(paper, vec3(0.055, 0.035, 0.023) + grain * 0.035, charBand);
      vec3 color = mix(after, paper, intact);

      // A narrow ember seam, with a softer warm halo rather than a neon outline.
      float flicker = 0.74 + 0.18 * sin(u_time * 17.0 + p.y * 71.0)
                           + 0.08 * sin(u_time * 29.0 + p.x * 93.0);
      float hot = exp(-abs(edge) / 0.0034) * flicker;
      float glow = exp(-abs(edge) / 0.016) * 0.30;
      flicker = mix(flicker, 0.82, u_calm);
      float emberBreaks = 0.58 + 0.42 * noise(p * 92.0 + vec2(u_time * 0.5 * (1.0 - u_calm), 0.0));
      color += vec3(1.0, 0.19, 0.022) * (hot * 0.83 + glow) * emberBreaks;
      color += vec3(1.0, 0.66, 0.20) * pow(hot, 3.0) * 0.55;
      gl_FragColor = vec4(color, 1.0);
    }`;

  function createRenderer(canvas, images) {
    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power'
    });
    if (!gl) return null;
    const shaders = [], textures = [];
    let program, buffer;
    const dispose = () => {
      textures.forEach(texture => gl.deleteTexture(texture));
      shaders.forEach(shader => gl.deleteShader(shader));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    };
    try {
      function compile(type, source) {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Burn shader could not compile');
        return shader;
      }
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Burn shader could not link');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      images.forEach((img, index) => {
        const texture = gl.createTexture();
        textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.uniform1i(gl.getUniformLocation(program, index ? 'u_after' : 'u_before'), index);
      });
      const uniforms = Object.fromEntries(['origin', 'aspect', 'reach', 'progress', 'time', 'calm', 'before', 'after'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
      return {
        kind: 'webgl',
        resize() {
          const box = canvas.getBoundingClientRect();
          const ratio = Math.min(devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.round(box.width * ratio));
          canvas.height = Math.max(1, Math.round(box.height * ratio));
          gl.viewport(0, 0, canvas.width, canvas.height);
        },
        draw(progress, seconds, origin, from, calm) {
          if (gl.isContextLost()) throw new Error('WebGL context lost');
          gl.uniform1i(uniforms.before, from);
          gl.uniform1i(uniforms.after, 1 - from);
          gl.uniform1f(uniforms.calm, calm ? 1 : 0);
          const aspect = images[0].naturalWidth / images[0].naturalHeight;
          const reach = Math.hypot(Math.max(origin[0], 1 - origin[0]) * aspect, Math.max(origin[1], 1 - origin[1]));
          gl.uniform2fv(uniforms.origin, origin);
          gl.uniform1f(uniforms.aspect, aspect);
          gl.uniform1f(uniforms.reach, reach);
          gl.uniform1f(uniforms.progress, progress);
          gl.uniform1f(uniforms.time, seconds);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        dispose
      };
    } catch {
      dispose();
      return null;
    }
  }

  // CPU counterpart for browsers without WebGL (or after a lost context).
  // It keeps the same advancing burn/char/ember transition, never a crossfade.
  function createPaperRenderer(canvas, images) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable');
    const aspect = images[0].naturalWidth / images[0].naturalHeight;
    const width = 320, height = Math.round(width / aspect);
    canvas.width = width; canvas.height = height;
    const pixels = images.map(img => {
      context.drawImage(img, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    });
    const result = context.createImageData(width, height);
    const grain = new Float32Array(width * height);
    const field = new Float32Array(grain.length);
    let previousOrigin = null;
    const fract = n => n - Math.floor(n);
    const mix = (a, b, t) => a + (b - a) * t;
    const smooth = (a, b, n) => { const t = Math.max(0, Math.min(1, (n - a) / (b - a))); return t * t * (3 - 2 * t); };
    const hash = (x, y) => {
      x = fract(x * 123.34); y = fract(y * 456.21);
      const dot = x * (x + 45.32) + y * (y + 45.32);
      return fract((x + dot) * (y + dot));
    };
    const noise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return mix(mix(hash(ix, iy), hash(ix + 1, iy), ux), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let px = x / width * aspect * 8.5, py = (1 - y / height) * 8.5, weight = .53, value = 0;
      for (let octave = 0; octave < 5; octave++) {
        value += weight * noise(px, py);
        [px, py] = [(px * .8 + py * .6) * 2.03 + 9.7, (-px * .6 + py * .8) * 2.03 + 9.7];
        weight *= .48;
      }
      grain[y * width + x] = value;
    }
    return {
      kind: 'canvas2d',
      resize() {}, // CSS scales the fixed-resolution fallback with the plate.
      dispose() {},
      draw(progress, seconds, origin, from, calm) {
        if (previousOrigin !== origin) {
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const i = y * width + x;
            field[i] = Math.hypot((x / width - origin[0]) * aspect, 1 - y / height - origin[1]) + (grain[i] - .5) * .24;
          }
          previousOrigin = origin;
        }
        const before = pixels[from], after = pixels[1 - from], out = result.data;
        const reach = Math.hypot(Math.max(origin[0], 1 - origin[0]) * aspect, Math.max(origin[1], 1 - origin[1]));
        const front = mix(-.13, reach + .17, progress ** .88);
        const flicker = calm ? .82 : .82 + .12 * Math.sin(seconds * 17);
        for (let i = 0; i < field.length; i++) {
          const offset = i * 4, edge = field[i] - front;
          if (progress === 0 || edge > .085 || progress === 1 || edge < -.085) {
            const source = progress === 0 || (progress < 1 && edge > 0) ? before : after;
            out[offset] = source[offset]; out[offset + 1] = source[offset + 1]; out[offset + 2] = source[offset + 2];
          } else {
            const intact = smooth(-.002, .002, edge);
            const scorch = (1 - smooth(.016, .072, edge)) * .88;
            const char = 1 - smooth(.003, .031, edge);
            const hot = Math.exp(-Math.abs(edge) / .0034) * flicker;
            const glow = Math.exp(-Math.abs(edge) / .016) * .3;
            for (let c = 0; c < 3; c++) {
              const browned = before[offset + c] * [ .49, .31, .17 ][c];
              const paper = mix(mix(before[offset + c], browned, scorch), ([ .055, .035, .023 ][c] + grain[i] * .035) * 255, char);
              const ember = [1, .19, .022][c] * (hot * .83 + glow) * (.58 + .42 * grain[i]) + [1, .66, .20][c] * hot ** 3 * .55;
              out[offset + c] = mix(after[offset + c], paper, intact) + ember * 255;
            }
          }
          out[offset + 3] = 255;
        }
        context.putImageData(result, 0, 0);
      }
    };
  }

  window.installDuelBurn = function ({ root, reducedMotion, beforeActivate }) {
    const plate = root.querySelector('[data-duel-burn]');
    if (!plate) return { finish() {}, resize() {}, isActive: () => false };
    const art = plate.querySelector('.duel-art');
    const images = [plate.querySelector('.duel-before'), plate.querySelector('.duel-after')];
    let canvas = plate.querySelector('canvas');
    const hint = plate.querySelector('.duel-cue');
    const status = plate.closest('figure').querySelector('.duel-status');
    const description = plate.closest('figure').querySelector('#duel-scene');
    let phase = 'ready', current = 0, renderer = null, frame = 0, epoch = 0, run = null;
    const isActive = () => phase === 'loading' || phase === 'burning';
    function setPhase(value) {
      phase = value;
      plate.dataset.burnState = value;
      plate.dataset.burnFrame = String(current);
      plate.setAttribute('aria-label', value === 'loading' ? 'Подготовка гравюры' : value === 'burning' ? 'Гравюра сгорает'
        : current ? 'Сжечь гравюру и вернуть первый кадр боя' : 'Сжечь гравюру и открыть второй кадр боя');
      plate.setAttribute('aria-busy', String(isActive()));
      hint.textContent = current ? 'Сжечь и вернуть первый кадр' : 'Нажмите на гравюру';
    }
    function settle(index) {
      ++epoch;
      cancelAnimationFrame(frame); frame = 0; run = null;
      current = index;
      setPhase(current ? 'revealed' : 'ready');
      canvas.hidden = true;
      plate.dataset.burnProgress = '1';
      status.textContent = current ? 'Открыт второй кадр. Нажмите, чтобы через сгорание вернуть первый.' : 'Открыт первый кадр. Нажмите, чтобы через сгорание открыть второй.';
      description.textContent = current
        ? 'Второй кадр: чёрный рыцарь наносит удар мечом в бок героини. Она остаётся на ногах с поднятым мечом. Гравюра без крови.'
        : 'Героиня-рыцарь справа и рыцарь в чёрных доспехах слева замахиваются мечами. На её щите герб Тинькофф, на щите противника косматый бес.';
    }
    // Only intentional navigation commits a partial burn before page cloning.
    function finish() { if (isActive()) settle(phase === 'burning' ? run.to : current); }
    function fail() {
      settle(current);
      status.textContent = 'Не удалось запустить сгорание. Кадр сохранён. Нажмите, чтобы попробовать ещё раз.';
    }
    function usePaperRenderer() {
      renderer?.dispose(); renderer = null;
      // A canvas with a WebGL context cannot also acquire a 2D context.
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement); canvas = replacement;
      renderer = createPaperRenderer(canvas, images);
      plate.dataset.burnRenderer = renderer.kind;
    }
    function draw() {
      try { renderer.draw(run.elapsed / run.duration, run.elapsed / 1000, run.origin, run.from, run.calm); }
      catch {
        if (renderer?.kind !== 'webgl') throw new Error('Paper renderer failed');
        usePaperRenderer();
        renderer.draw(run.elapsed / run.duration, run.elapsed / 1000, run.origin, run.from, run.calm);
      }
      plate.dataset.burnProgress = (run.elapsed / run.duration).toFixed(3);
    }
    function tick(now) {
      frame = 0;
      if (phase !== 'burning' || document.hidden) return;
      // Count displayed time: backgrounding or a slow frame cannot skip the burn.
      if (run.lastTime !== null) run.elapsed = Math.min(run.duration, run.elapsed + Math.min(64, Math.max(0, now - run.lastTime)));
      run.lastTime = now;
      try { draw(); } catch { fail(); return; }
      if (run.elapsed === run.duration) settle(run.to);
      else frame = requestAnimationFrame(tick);
    }
    function resize() {
      if (phase !== 'burning') return;
      try { renderer.resize(); draw(); } catch { fail(); }
    }
    async function activate(event) {
      if (isActive() || beforeActivate?.() === false) return;
      const box = art.getBoundingClientRect();
      const origin = event.detail === 0 ? [.52, .46] : [
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
        Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height))
      ];
      const request = ++epoch;
      setPhase('loading');
      try { await Promise.all(images.map(img => img.decode())); }
      catch { if (request === epoch) fail(); return; }
      if (request !== epoch) return;
      try {
        renderer ||= createRenderer(canvas, images);
        if (!renderer) usePaperRenderer();
        plate.dataset.burnRenderer = renderer.kind;
        run = { from: current, to: 1 - current, origin, elapsed: 0, lastTime: null,
          duration: reducedMotion.matches ? 1200 : 3600, calm: reducedMotion.matches };
        setPhase('burning');
        canvas.hidden = false;
        renderer.resize(); draw();
        if (!document.hidden) frame = requestAnimationFrame(tick);
      } catch { fail(); }
    }
    // A swipe/drag across the engraving must not become a burn click.
    let press = null, dragged = false;
    plate.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
    });
    plate.addEventListener('pointermove', event => {
      if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) dragged = true;
    });
    plate.addEventListener('pointerup', event => { if (press?.id === event.pointerId) press = null; });
    plate.addEventListener('pointercancel', event => { if (press?.id === event.pointerId) { press = null; dragged = true; } });
    plate.addEventListener('pointerleave', () => { if (press) dragged = true; });
    plate.addEventListener('click', event => {
      if (event.detail !== 0 && dragged) return;
      activate(event);
    });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (renderer?.kind === 'canvas2d') return;
      if (phase !== 'burning') { renderer = null; return; }
      try { usePaperRenderer(); draw(); } catch { fail(); }
    });
    reducedMotion.addEventListener('change', () => { if (run) run.calm = reducedMotion.matches; });
    const visibility = () => {
      cancelAnimationFrame(frame); frame = 0;
      if (!run) return;
      run.lastTime = null;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; if (run) run.lastTime = null; });
    window.addEventListener('pageshow', visibility);
    setPhase('ready');
    return { finish, resize, isActive };
  };
})();
