/* Motion adapter for the vendored StPageFlip 2.0.7 (MIT).
 * Keep its fold geometry and DOM renderer; replace linear timing and the
 * mouse/touch split with one continuous pointer gesture. No CSS interpolation
 * is applied to the paper itself: the grabbed point follows the pointer.
 */
(() => {
  'use strict';
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const settleEase = t => 1 - Math.pow(1 - t, 3);

  window.installBookMotion = function (app, element, reducedMotion, options = {}) {
    const flip = app.getFlipController();
    const renderer = app.getRender();
    let gesture = null, peekReturning = false;

    // The incoming surface is known before a hover, drag or click paints its first fold.
    // This also handles chapter shortcuts, whose target may be non-adjacent.
    const originalStart = flip.start;
    flip.start = function (point) {
      options.onBeforeFold?.();
      const started = originalStart.call(this, point);
      options.onFold?.(started ? this.bottomPage : null);
      return started;
    };

    // These hooks are deliberately confined to this adapter and the pinned
    // vendor version. The source geometry, page data and vendor file stay intact.
    flip.animateFlippingTo = function (start, dest, turned, reset = true) {
      const rect = renderer.getRect();
      const wasDragging = this.getState() === 'user_fold';
      const isPeek = this.getState() === 'fold_corner';
      peekReturning = isPeek && reset;
      const fraction = clamp(Math.hypot(dest.x - start.x, dest.y - start.y) / (2 * rect.pageWidth), 0, 1);
      const duration = isPeek ? (reset ? 300 : 280)
        : wasDragging ? clamp(300 + 500 * fraction, 320, 790)
          : turned ? 1100 : clamp(260 + 380 * fraction, 280, 580);
      const corner = this.getCalculation()?.getCorner();
      const arc = !wasDragging && !isPeek && turned ? rect.height * .105 * fraction : 0;
      const curve = wasDragging ? settleEase : ease;
      const steps = Math.max(60, Math.ceil(duration / 4));
      const frames = Array.from({ length: steps + 1 }, (_, index) => () => {
        const t = curve(index / steps);
        const lift = arc * Math.sin(Math.PI * t);
        this.do({
          x: start.x + (dest.x - start.x) * t,
          y: start.y + (dest.y - start.y) * t + (corner === 'bottom' ? -lift : lift)
        });
      });
      const finish = () => {
        if (!this.getCalculation()) return;
        frames[frames.length - 1]();
        if (turned) {
          if (this.getCalculation().getDirection() === 1) app.turnToPrevPage();
          else app.turnToNextPage();
        }
        if (reset) {
          peekReturning = false;
          renderer.setBottomPage(null);
          renderer.setFlippingPage(null);
          renderer.clearShadow();
          this.setState('read');
          this.reset();
        }
      };
      // Interrupting a hover must preserve its current geometry, not jump to
      // the last frame and invoke an obsolete completion callback.
      renderer.animation = null;
      if (!isPeek) this.setState('flipping');
      if (reducedMotion.matches) { finish(); return; }
      element.dataset.motionDuration = String(Math.round(duration));
      element.dataset.motionKind = isPeek ? 'corner' : wasDragging ? (turned ? 'release' : 'return') : 'turn';
      renderer.startAnimation(frames, duration, finish);
    };

    flip.flip = function (point) {
      if (this.getState() === 'flipping') return;
      const rect = renderer.getRect();
      const bookPoint = renderer.convertToBook(point);
      const direction = this.getDirectionByPoint(bookPoint);
      const corner = bookPoint.y >= rect.height / 2 ? 'bottom' : 'top';
      let calculation = this.getCalculation();
      const continueFold = calculation && calculation.getDirection() === direction && calculation.getCorner() === corner;
      renderer.animation = null;
      if (!continueFold && !this.start(point)) return;
      calculation = this.getCalculation();
      const start = continueFold ? { ...calculation.getPosition() }
        : { x: rect.pageWidth - 1, y: corner === 'bottom' ? rect.height - 1 : 1 };
      this.setState('flipping');
      calculation.calc(start);
      this.animateFlippingTo(start, { x: -rect.pageWidth, y: corner === 'bottom' ? rect.height : 0 }, true);
    };

    flip.showCorner = function (point) {
      if (reducedMotion.matches || peekReturning || !['read', 'fold_corner'].includes(this.getState())) return;
      const rect = renderer.getRect();
      const direction = this.getDirectionByPoint(renderer.convertToBook(point));
      if (options.canBoundary?.(direction)) {
        if (this.getState() === 'fold_corner') {
          renderer.animation = null;
          renderer.setBottomPage(null); renderer.setFlippingPage(null); renderer.clearShadow();
          this.reset(); this.setState('read');
        }
        return;
      }
      if (this.isPointOnCorners(point)) {
        if (this.getCalculation()) return;
        if (!this.start(point)) return;
        this.setState('fold_corner');
        const bottom = this.getCalculation().getCorner() === 'bottom';
        const size = clamp(rect.pageWidth * .035, 10, 20);
        const start = { x: rect.pageWidth - 1, y: bottom ? rect.height - 1 : 1 };
        this.getCalculation().calc(start);
        this.animateFlippingTo(start, { x: rect.pageWidth - size, y: bottom ? rect.height - size : size }, false, false);
      } else if (this.getCalculation() && this.getState() === 'fold_corner') {
        const start = { ...this.getCalculation().getPosition() };
        const y = this.getCalculation().getCorner() === 'bottom' ? rect.height : 0;
        this.animateFlippingTo(start, { x: rect.pageWidth, y }, false);
      }
    };

    const pointOf = event => {
      const box = element.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const interactive = target => target.closest('button,a,input,textarea,select');
    element.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || interactive(event.target) || flip.getState() === 'flipping') return;
      const point = pointOf(event);
      renderer.animation = null;
      peekReturning = false;
      const rect = renderer.getRect();
      const bookPoint = renderer.convertToBook(point);
      const direction = flip.getDirectionByPoint(bookPoint);
      const corner = bookPoint.y >= rect.height / 2 ? 'bottom' : 'top';
      if (options.canBoundary?.(direction)) {
        gesture = { id: event.pointerId, boundary: direction, start: point, last: point, lastTime: event.timeStamp, velocity: 0, moved: false };
        element.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      const current = flip.getCalculation();
      const sameFold = current && current.getDirection() === direction && current.getCorner() === corner;
      if (!sameFold) {
        renderer.setBottomPage(null); renderer.setFlippingPage(null); renderer.clearShadow();
        flip.reset(); flip.setState('read');
        // Choose the side at pointer-down, before a fast drag can cross the spine.
        if (!flip.start(point)) return;
        flip.getCalculation().calc({ x: rect.pageWidth - 1, y: corner === 'bottom' ? rect.height - 1 : 1 });
      }
      gesture = { id: event.pointerId, start: point, last: point, lastTime: event.timeStamp, velocity: 0, moved: false };
      app.startUserTouch(point);
      element.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    element.addEventListener('pointermove', event => {
      const point = pointOf(event);
      if (!gesture) {
        if (event.pointerType === 'mouse' && !interactive(event.target)) flip.showCorner(point);
        return;
      }
      if (gesture.id !== event.pointerId) return;
      const elapsed = event.timeStamp - gesture.lastTime;
      if (elapsed > 0) gesture.velocity = (point.x - gesture.last.x) / elapsed;
      gesture.last = point; gesture.lastTime = event.timeStamp;
      if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > 5) gesture.moved = true;
      if (gesture.boundary == null && gesture.moved && !reducedMotion.matches) app.userMove(point, true);
    });
    function release(event, cancelled = false) {
      if (!gesture || gesture.id !== event.pointerId) return;
      const point = pointOf(event), held = gesture;
      gesture = null;
      if (held.boundary != null) {
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        const travel = (point.x - held.start.x) * (held.boundary === 0 ? -1 : 1);
        if (!cancelled && (!held.moved || travel > 30)) options.onBoundary?.(held.boundary);
        return;
      }
      app.userStop(point, true); // no new swipe: finish the existing fold instead
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (!held.moved) {
        if (!cancelled) flip.flip(point);
        else if (flip.getCalculation()) flip.stopMove();
        return;
      }
      const dx = point.x - held.start.x;
      if (reducedMotion.matches) {
        if (!cancelled && Math.abs(dx) > 30 && flip.checkDirection(dx < 0 ? 0 : 1)) {
          dx < 0 ? app.turnToNextPage() : app.turnToPrevPage();
        }
        flip.reset(); flip.setState('read');
        return;
      }
      const calculation = flip.getCalculation();
      if (!calculation) return;
      const forward = calculation.getDirection() === 0;
      const directionalDx = dx * (forward ? -1 : 1);
      const freshVelocity = event.timeStamp - held.lastTime < 100 ? held.velocity * (forward ? -1 : 1) : 0;
      const threshold = app.getOrientation() === 'portrait' ? 32 : 48;
      const turned = !cancelled && (calculation.getFlippingProgress() > threshold || (directionalDx > 35 && freshVelocity > .45));
      const rect = renderer.getRect();
      const start = { ...calculation.getPosition() };
      flip.animateFlippingTo(start, { x: turned ? -rect.pageWidth : rect.pageWidth, y: calculation.getCorner() === 'bottom' ? rect.height : 0 }, turned);
    }
    element.addEventListener('pointerup', event => release(event));
    element.addEventListener('pointercancel', event => release(event, true));
    element.addEventListener('pointerleave', () => {
      if (!gesture && flip.getState() === 'fold_corner') flip.showCorner({ x: -100, y: -100 });
    });
    // Reset completed pages only when the window changes size, never in a drag.
    return {
      finish: () => renderer.finishAnimation(),
      suspend() {
        renderer.finishAnimation();
        if (gesture) {
          if (gesture.boundary == null) app.userStop(gesture.last, true);
          if (element.hasPointerCapture(gesture.id)) element.releasePointerCapture(gesture.id);
          gesture = null;
        }
        renderer.animation = null;
        peekReturning = false;
        renderer.setBottomPage(null); renderer.setFlippingPage(null); renderer.clearShadow();
        flip.reset(); flip.setState('read');
        options.onFold?.(null);
      }
    };
  };
})();
