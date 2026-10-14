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
      float emberBreaks = 0.58 + 0.42 * noise(p * 92.0 + vec2(u_time * 0.5, 0.0));
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
      const uniforms = Object.fromEntries(['origin', 'aspect', 'reach', 'progress', 'time'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
      return {
        resize() {
          const box = canvas.getBoundingClientRect();
          const ratio = Math.min(devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.round(box.width * ratio));
          canvas.height = Math.max(1, Math.round(box.height * ratio));
          gl.viewport(0, 0, canvas.width, canvas.height);
        },
        draw(progress, seconds, origin) {
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

  window.installDuelBurn = function ({ root, reducedMotion, beforeActivate }) {
    const plate = root.querySelector('[data-duel-burn]');
    if (!plate) return { finish() {} };
    const art = plate.querySelector('.duel-art');
    const images = [plate.querySelector('.duel-before'), plate.querySelector('.duel-after')];
    const canvas = plate.querySelector('canvas');
    const hint = plate.querySelector('.duel-cue');
    const status = plate.closest('figure').querySelector('.duel-status');
    const description = plate.closest('figure').querySelector('#duel-scene');
    let phase = 'ready', renderer = null, frame = 0, epoch = 0, fade = null;
    const labels = {
      ready: 'Сжечь гравюру и открыть второй кадр боя',
      loading: 'Подготовка второго кадра',
      burning: 'Гравюра сгорает',
      revealed: 'Вернуть первый кадр боя'
    };
    const ready = () => Promise.all(images.map(img => img.decode()));
    function setPhase(value) {
      phase = value;
      plate.dataset.burnState = value;
      plate.setAttribute('aria-label', labels[value]);
      plate.setAttribute('aria-busy', String(value === 'loading' || value === 'burning'));
      hint.textContent = value === 'revealed' ? 'Вернуть первый кадр' : 'Нажмите на гравюру';
    }
    function settle(revealed) {
      ++epoch;
      cancelAnimationFrame(frame);
      frame = 0;
      fade?.cancel(); fade = null;
      canvas.hidden = true;
      plate.dataset.burnProgress = revealed ? '1' : '0';
      setPhase(revealed ? 'revealed' : 'ready');
      status.textContent = revealed ? 'Открыт второй кадр боя. Нажмите, чтобы вернуть первый.' : 'Первый кадр. Можно повторить сгорание.';
      description.textContent = revealed
        ? 'Второй кадр: чёрный рыцарь наносит удар мечом в бок героини. Она остаётся на ногах с поднятым мечом. Гравюра без крови.'
        : 'Героиня-рыцарь справа и рыцарь в чёрных доспехах слева замахиваются мечами. На её щите герб Тинькофф, на щите противника косматый бес.';
    }
    function finish() {
      if (phase === 'burning') settle(true);
      else if (phase === 'loading') settle(false);
    }
    async function activate(event) {
      if (phase === 'burning' || phase === 'loading' || beforeActivate?.() === false) return;
      if (phase === 'revealed') {
        settle(false);
        return;
      }
      const box = art.getBoundingClientRect();
      const origin = event.detail === 0 ? [0.52, 0.46] : [
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
        Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height))
      ];
      const request = ++epoch;
      setPhase('loading');
      try { await ready(); } catch {
        if (request !== epoch) return;
        settle(false);
        status.textContent = 'Второй кадр не загрузился. Нажмите, чтобы попробовать ещё раз.';
        return;
      }
      if (request !== epoch) return;
      if (reducedMotion.matches) { settle(true); return; }
      renderer ||= createRenderer(canvas, images);
      setPhase('burning');
      if (!renderer) {
        // A browser without WebGL still reveals the second engraving.
        fade = images[0].animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
        fade.onfinish = () => settle(true);
        return;
      }
      canvas.hidden = false;
      renderer.resize();
      renderer.draw(0, 0, origin);
      const start = performance.now();
      function tick(now) {
        if (request !== epoch) return;
        const progress = Math.min(1, (now - start) / 3600);
        renderer.draw(progress, (now - start) / 1000, origin);
        plate.dataset.burnProgress = progress.toFixed(3);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else settle(true);
      }
      frame = requestAnimationFrame(tick);
    }
    // A swipe/drag across the engraving must not become a burn/reset click.
    let press = null, dragged = false;
    plate.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
    });
    plate.addEventListener('pointermove', event => {
      if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) dragged = true;
    });
    plate.addEventListener('pointerup', () => { press = null; });
    plate.addEventListener('pointercancel', () => { press = null; dragged = true; });
    plate.addEventListener('pointerleave', () => { if (press) dragged = true; });
    plate.addEventListener('click', event => {
      if (event.detail !== 0 && dragged) return;
      activate(event);
    });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      finish();
      renderer = null;
    });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
    window.addEventListener('pagehide', finish);
    setPhase('ready');
    return { finish };
  };
})();
