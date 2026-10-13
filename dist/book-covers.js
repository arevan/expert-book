/* A separate pair of boards around the unchanged twelve-page renderer. */
(() => {
  'use strict';
  const STATES = new Set(['front', 'open', 'back']);
  const DURATION = 1100;
  const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
  const ornament = `<svg viewBox="0 0 180 70" aria-hidden="true"><path d="M18 40c23 13 38-26 72-9 34-17 49 22 72 9M35 44c20 0 20-16 34-17m76 17c-20 0-20-16-34-17M90 52V15m0 21C68 35 66 16 68 12c19 1 23 17 22 24Zm0 0c22-1 24-20 22-24-19 1-23 17-22 24ZM72 53h36M81 59h18"/><circle cx="90" cy="9" r="2.5"/></svg>`;

  window.installBookCovers = function ({
    holder, book, reducedMotion, isMobile, initialState = 'front',
    getPageSurface, onChange = () => {}, onActivate = () => {}
  }) {
    let state = STATES.has(initialState) ? initialState : 'front';
    let busy = false, pending = null, visibleSide = state === 'back' ? 'back' : 'front';
    let pageWidth = 0, mobile = false;
    const underlays = [book, ...Array.from(holder.children).filter(node => node.matches('.cover, .paper-stack'))];
    const previousClips = new Map(underlays.map(node => [node, node.style.clipPath]));
    const stage = document.createElement('div');
    stage.className = 'book-covers';
    stage.innerHTML = `<div class="book-cover-board">
      <button class="book-cover-face book-cover-outside" type="button">
        <span class="book-cover-print">
          <span class="book-cover-front-design">
            <span class="book-cover-eyebrow">Настольная книга дизайнера</span>
            <span class="book-cover-title"><span>Методы</span><span class="book-cover-title-small">подготовки</span><span>эксперта</span></span>
            <span class="book-cover-ornament">${ornament}</span>
            <span class="book-cover-date">MMXXVI</span>
          </span>
          <span class="book-cover-back-design"><span class="book-cover-ornament">${ornament}</span><span class="book-cover-mark">ARS · DESIGN</span></span>
        </span>
      </button>
      <div class="book-cover-face book-cover-inside book" aria-hidden="true" inert><div class="book-leaf book-cover-clone"></div></div>
    </div>`;
    holder.append(stage);
    const board = stage.querySelector('.book-cover-board');
    const button = stage.querySelector('.book-cover-outside');
    const cloneHost = stage.querySelector('.book-cover-clone');
    button.addEventListener('click', () => { if (!busy && state !== 'open') onActivate(); });

    function measure() {
      mobile = isMobile();
      pageWidth = holder.clientWidth / (mobile ? 1 : 2);
      const scale = parseFloat(getComputedStyle(book).getPropertyValue('--page-scale')) || pageWidth / 560;
      stage.style.setProperty('--cover-scale', scale);
      stage.style.setProperty('--page-scale', scale);
      stage.style.setProperty('--cover-page-width', pageWidth + 'px');
      stage.dataset.mobile = String(mobile);
    }
    function configure(side) {
      visibleSide = side;
      stage.dataset.side = side;
      board.style.left = mobile || side === 'back' ? '0px' : pageWidth + 'px';
      board.style.transformOrigin = side === 'front' ? 'left center' : 'right center';
      button.setAttribute('aria-label', side === 'front' ? 'Открыть книгу' : 'Вернуться к последней главе');
      const surface = getPageSurface(side);
      cloneHost.replaceChildren();
      if (surface) {
        const clone = surface.cloneNode(true);
        for (const node of [clone, ...clone.querySelectorAll('*')]) {
          for (const attribute of ['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) node.removeAttribute(attribute);
        }
        clone.setAttribute('aria-hidden', 'true');
        clone.inert = true;
        cloneHost.append(clone);
      }
    }
    function pose(side, angle) {
      const direction = side === 'front' ? -1 : 1;
      const shift = mobile ? 0 : direction * pageWidth / 2 * (1 - angle / 180);
      const clip = mobile ? 0 : 50 * Math.min(1, Math.max(0, 1 + Math.cos(angle * Math.PI / 180)));
      return {
        board: `rotateY(${direction * angle}deg)`,
        holder: `translateX(${shift}px)`,
        clip: side === 'front' ? `inset(-100px 0% -100px ${clip}%)` : `inset(-100px ${clip}% -100px 0%)`
      };
    }
    function applyPose(side, angle) {
      const value = pose(side, angle);
      board.style.transform = value.board;
      holder.style.transform = value.holder;
      for (const node of underlays) node.style.clipPath = mobile ? previousClips.get(node) : value.clip;
    }
    function setAccess() {
      const unavailable = busy || state !== 'open';
      book.inert = unavailable;
      if (unavailable) book.setAttribute('aria-hidden', 'true');
      else book.removeAttribute('aria-hidden');
      button.disabled = busy;
      stage.setAttribute('aria-hidden', String(busy || state === 'open'));
      holder.dataset.coverState = state;
      holder.dataset.coverBusy = String(busy);
    }
    function applyStatic() {
      measure();
      configure(state === 'open' ? visibleSide : state);
      applyPose(visibleSide, state === 'open' ? 180 : 0);
      stage.hidden = state === 'open';
      if (state === 'open') {
        holder.style.removeProperty('transform');
        for (const node of underlays) node.style.clipPath = previousClips.get(node);
      }
      setAccess();
    }
    function complete(operation) {
      if (pending !== operation) return;
      pending = null;
      for (const animation of operation.animations) animation.cancel();
      state = operation.target;
      busy = false;
      applyStatic();
      onChange({ state, busy });
      if (operation.restoreFocus) {
        const target = state === 'open' ? book : button;
        if (target === book && !book.hasAttribute('tabindex')) book.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      operation.resolve();
    }
    function animateSegment(operation, segments, index) {
      if (pending !== operation) return;
      if (index === segments.length) { complete(operation); return; }
      for (const animation of operation.animations) animation.cancel();
      operation.animations = [];
      const { side, from, to } = segments[index];
      configure(side);
      stage.hidden = false;
      applyPose(side, from);
      const frames = Array.from({ length: 121 }, (_, i) => {
        const offset = i / 120;
        return { offset, ...pose(side, from + (to - from) * smooth(offset)) };
      });
      const timing = { duration: DURATION / segments.length, easing: 'linear', fill: 'forwards' };
      operation.animations.push(board.animate(frames.map(frame => ({ offset: frame.offset, transform: frame.board })), timing));
      operation.animations.push(holder.animate(frames.map(frame => ({ offset: frame.offset, transform: frame.holder })), timing));
      if (!mobile) for (const node of underlays) {
        operation.animations.push(node.animate(frames.map(frame => ({ offset: frame.offset, clipPath: frame.clip })), timing));
      }
      Promise.all(operation.animations.map(animation => animation.finished)).then(
        () => animateSegment(operation, segments, index + 1),
        () => { /* finish() applies the final pose and invalidates this operation. */ }
      );
    }
    function finish() { if (pending) complete(pending); }
    function transition(target, animate = true) {
      if (!STATES.has(target)) return Promise.reject(new TypeError('Unknown book cover state: ' + target));
      finish();
      if (target === state) { applyStatic(); return Promise.resolve(); }
      const source = state;
      const focused = document.activeElement;
      const restoreFocus = stage.contains(focused) || book.contains(focused);
      if (restoreFocus && focused instanceof HTMLElement) focused.blur();
      state = target;
      busy = true;
      measure();
      setAccess();
      onChange({ state, busy });
      return new Promise(resolve => {
        const operation = { target, resolve, restoreFocus, animations: [] };
        pending = operation;
        if (!animate || reducedMotion.matches || !board.animate) { complete(operation); return; }
        const segments = [];
        if (source !== 'open') segments.push({ side: source, from: 0, to: 180 });
        if (target !== 'open') segments.push({ side: target, from: 180, to: 0 });
        animateSegment(operation, segments, 0);
      });
    }
    function sync() { finish(); applyStatic(); }
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finish(); });
    applyStatic();
    onChange({ state, busy });
    return { transition, finish, sync, get state() { return state; }, get busy() { return busy; } };
  };
})();
