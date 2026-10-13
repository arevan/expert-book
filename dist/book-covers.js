/* Rigid boards outside the paper renderer. Each board meets its real endpaper. */
(() => {
  'use strict';
  const STATES = new Set(['front', 'open', 'back']);
  const DURATION = 1250;
  const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);

  window.installBookCovers = function ({
    holder, book, reducedMotion, isMobile, initialState = 'front',
    getPageSurface, getPageGeometry, onChange = () => {}, onActivate = () => {}
  }) {
    let state = STATES.has(initialState) ? initialState : 'front';
    let busy = false, pending = null, visibleSide = state === 'back' ? 'back' : 'front';
    let pageWidth = 0, surfaceX = 0, mobile = false;
    const previousClip = book.style.clipPath;
    // A single ground shadow survives both static and moving cover states.
    const groundShadow = document.createElement('div');
    groundShadow.className = 'book-ground-shadow';
    groundShadow.setAttribute('aria-hidden', 'true');
    holder.prepend(groundShadow);
    const stage = document.createElement('div');
    stage.className = 'book-covers';
    stage.innerHTML = `<div class="book-cover-board">
      <button class="book-cover-face book-cover-outside" type="button"><span class="book-cover-print" aria-hidden="true"></span></button>
      <div class="book-cover-face book-cover-inside" aria-hidden="true" inert><div class="book-cover-clone"></div></div>
    </div>`;
    holder.append(stage);
    const board = stage.querySelector('.book-cover-board');
    const button = stage.querySelector('.book-cover-outside');
    const cloneHost = stage.querySelector('.book-cover-clone');
    button.addEventListener('click', () => { if (!busy && state !== 'open') onActivate(); });

    function measure() {
      mobile = isMobile();
      // Use the renderer's fractional origin and dimensions, not rounded clientWidth.
      const rect = getPageGeometry();
      pageWidth = rect.pageWidth;
      surfaceX = rect.left + (mobile ? pageWidth : 0);
      holder.style.setProperty('--page-scale', pageWidth / 560);
      holder.style.setProperty('--surface-x', surfaceX + 'px');
      holder.style.setProperty('--surface-y', rect.top + 'px');
      holder.style.setProperty('--surface-width', (mobile ? pageWidth : rect.width) + 'px');
      holder.style.setProperty('--surface-height', rect.height + 'px');
      stage.style.inset = 'auto';
      stage.style.left = (rect.left + (mobile ? pageWidth : 0)) + 'px';
      stage.style.top = rect.top + 'px';
      stage.style.width = (mobile ? pageWidth : rect.width) + 'px';
      stage.style.height = rect.height + 'px';
      const scale = pageWidth / 560;
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
      button.setAttribute('aria-label', side === 'front' ? 'Открыть книгу' : 'Открыть задний форзац');
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
      const openness = angle / 180, rim = 6 * pageWidth / 560;
      // The footprint grows only after the board crosses the vertical plane.
      // Before that its projection stays above the stationary half of the book.
      const extension = Math.max(0, -Math.cos(angle * Math.PI / 180));
      const shadowLeft = side === 'back' ? surfaceX - rim
        : mobile ? surfaceX - rim * openness
          : surfaceX + pageWidth - (pageWidth + rim) * extension;
      const shadowWidth = mobile ? pageWidth + rim * (1 + openness)
        : (pageWidth + rim) * (1 + extension);
      return {
        shadowLeft: shadowLeft + 'px', shadowWidth: shadowWidth + 'px',
        board: `rotateY(${direction * angle}deg)`,
        holder: `translateX(${mobile ? 0 : direction * pageWidth / 2 * (1 - angle / 180)}px)`
      };
    }
    function applyPose(side, angle) {
      const value = pose(side, angle);
      board.style.transform = value.board;
      holder.style.transform = value.holder;
      groundShadow.style.left = value.shadowLeft;
      groundShadow.style.width = value.shadowWidth;
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
      holder.dataset.coverPhase = state === 'open' ? 'open' : 'closed';
      delete holder.dataset.turningCover;
      book.style.clipPath = previousClip;
      if (state === 'open') holder.style.removeProperty('transform');
      setAccess();
    }
    function complete(operation) {
      if (pending !== operation) return;
      pending = null;
      for (const animation of operation.animations) animation.cancel();
      state = operation.target;
      busy = false;
      // A single synchronous swap: the back face and the physical lining are identical.
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
      holder.dataset.coverPhase = 'turning';
      holder.dataset.turningCover = side;
      // Only the stationary flyleaf may show under a turning board. The other
      // half is represented solely by the board, never a duplicate paper page.
      const rect = getPageGeometry(), foldX = rect.left + rect.pageWidth;
      book.style.clipPath = mobile ? previousClip
        : side === 'front' ? `inset(-24px -24px -24px ${foldX}px)`
          : `inset(-24px ${book.getBoundingClientRect().width - foldX}px -24px -24px)`;
      applyPose(side, from);
      const frames = Array.from({ length: 121 }, (_, i) => {
        const offset = i / 120;
        return { offset, ...pose(side, from + (to - from) * smooth(offset)) };
      });
      const timing = { duration: DURATION / segments.length, easing: 'linear', fill: 'forwards' };
      operation.animations.push(board.animate(frames.map(frame => ({ offset: frame.offset, transform: frame.board })), timing));
      operation.animations.push(holder.animate(frames.map(frame => ({ offset: frame.offset, transform: frame.holder })), timing));
      operation.animations.push(groundShadow.animate(frames.map(frame => ({
        offset: frame.offset, left: frame.shadowLeft, width: frame.shadowWidth
      })), timing));
      Promise.all(operation.animations.map(animation => animation.finished)).then(
        () => animateSegment(operation, segments, index + 1),
        () => { /* finish() atomically applies the final pose. */ }
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
