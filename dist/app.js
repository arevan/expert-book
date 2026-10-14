(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ornament = `<svg class="ornament" viewBox="0 0 160 60" aria-hidden="true"><path d="M16 39c30 9 43-29 64-9 21-20 34 18 64 9M27 40c18 1 21-16 31-16M133 40c-18 1-21-16-31-16M80 44V13M80 31c-19 0-24-15-21-20 17 0 21 12 21 20Zm0 0c19 0 24-15 21-20-17 0-21 12-21 20ZM41 37c-12 1-16-7-15-12 11-1 16 6 15 12Zm78 0c12 1 16-7 15-12-11-1-16 6-15 12ZM68 44h24M75 49h10"/><circle cx="80" cy="9" r="3"/></svg>`;
  const title = {
    id: 'title', chapter: '', title: 'Титульный лист',
    left: `<figure class="chapter-illustration"><div class="chapter-plate"><img src="assets/studies/title-forge-v1.png" alt="Старинная гравюра: героиня с собранными волосами в кожаном фартуке куёт свои доспехи в кузне, формует наплечник на наковальне." draggable="false"></div><figcaption>Искусство превращать замысел в дело.</figcaption></figure>`,
    right: `<p class="title-eyebrow">Настольная книга<br>продуктового дизайнера</p><h1>Методы<span class="minor">подготовки</span>эксперта</h1><p class="subtitle">О видении, мастерстве<br>и общей ответственности</p>${ornament}<p class="title-credit">В пяти главах,<br>с наблюдениями и практическими советами</p><div class="colophon"><p>От сильного senior — к эксперту</p><p class="date">MMXXVI</p></div>`,
    note: 'Начните с вопроса аудитории: «Что, по-вашему, делает эксперт, когда не рисует концепты?» Соберите несколько ответов. Сегодня обсуждаем модель роли, которую мы внедряли в банке. Главная мысль: эксперт соединяет видение группы продуктов, высокую планку мастерства и влияние на решения команды. Путь к мастерству — образ развития качеств и ответственности эксперта. На следующем развороте расскажите вашу историю появления роли.'
  };
  const spreads = [title, ...(window.BOOK_CONTENT || [])];
  const book = $('#book'), holder = $('#book-holder');
  let pageFlip, bookMotion, covers, duelBurn;
  const mobileQuery = matchMedia('(max-width: 700px)'), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Two physical endpaper spreads surround the six editorial spreads.
  // 0: front lining, 1: flyleaf, 2..13: content, 14: flyleaf, 15: rear lining.
  const firstContentPage = 2;
  const maxPage = spreads.length * 2 + 3;
  const contentIndex = number => Math.floor((number - firstContentPage) / 2);
  const isEndpaper = number => number < firstContentPage || number > maxPage - 2;
  const frontBoundaryPage = () => mobileQuery.matches ? 1 : 0;
  const backBoundaryPage = () => maxPage - 1;
  let page = 0, busy = false, coverBusy = false, coverState = 'front', lastSize = "";
  let settledPage = 0, motionState = 'read', incomingFoldPage = null;
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem('expert-cookbook:' + key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem('expert-cookbook:' + key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const checks = storage.read('checks', {});
  function fromHash() {
    const raw = location.hash.slice(1).split('/');
    if (raw[0] === 'back-cover') return { state: 'back', page: backBoundaryPage() };
    if (raw[0] === 'front-endpaper') return { state: 'open', page: frontBoundaryPage() };
    if (raw[0] === 'back-endpaper') return { state: 'open', page: backBoundaryPage() };
    const i = spreads.findIndex(s => s.id === raw[0]);
    return i < 0 ? { state: 'front', page: frontBoundaryPage() }
      : { state: 'open', page: firstContentPage + i * 2 + (mobileQuery.matches && raw[1] === '2' ? 1 : 0) };
  }
  const initialLocation = fromHash();
  page = initialLocation.page;
  settledPage = page;
  coverState = initialLocation.state;
  function markChecks(el) {
    el.querySelectorAll('[data-check]').forEach(button => { button.setAttribute('aria-pressed', !!checks[button.dataset.check]); button.setAttribute('aria-label', button.textContent.trim()); });
  }
  function fill(el, pageNumber) {
    if (isEndpaper(pageNumber)) {
      const lining = pageNumber === 0 || pageNumber === maxPage;
      el.classList.add('endpaper-page', lining ? 'endpaper-lining' : 'endpaper-flyleaf');
      el.setAttribute('aria-label', pageNumber < firstContentPage ? 'Передний форзац' : 'Задний форзац');
      return;
    }
    const contentPage = pageNumber - firstContentPage;
    const spread = spreads[contentIndex(pageNumber)];
    const isRight = pageNumber % 2 === 1;
    el.classList.toggle('title-page', contentPage === 1);
    el.classList.toggle('frontispiece', contentPage === 0);
    el.classList.toggle('chapter-art-page', contentPage >= 2 && !isRight);
    el.classList.toggle('chapter-text-page', contentPage >= 2 && isRight);
    el.setAttribute('aria-label', `Страница ${contentPage + 1}: ${spread.title}`);
    el.innerHTML = `<div class="running"><span>${contentPage < 2 ? 'T DESIGN' : 'Методы подготовки эксперта'}</span><span>${spread.chapter ? 'ГЛАВА ' + spread.chapter : 'Том первый'}</span></div><div class="page-content">${isRight ? spread.right : spread.left}</div><div class="folio" aria-hidden="true">${contentPage + 1}</div>`;
    markChecks(el);
  }
  function render() { updateUI(); }
  function updateUI() {
    const i = contentIndex(page), endpaper = isEndpaper(page), spread = endpaper ? null : spreads[i];
    const endpaperTitle = page < firstContentPage ? 'Передний форзац' : 'Задний форзац';
    // Keep the physical block tied to the settled spread, not a pending flip event.
    // Hide a block early if the fold exposes a board lining beneath the turning leaf.
    holder.dataset.endpaper = isEndpaper(settledPage) ? (settledPage < firstContentPage ? 'front' : 'back') : 'none';
    holder.dataset.stackLeft = String(!mobileQuery.matches && settledPage >= firstContentPage && incomingFoldPage !== 0);
    holder.dataset.stackRight = String(mobileQuery.matches || (settledPage < backBoundaryPage() && incomingFoldPage !== maxPage));
    const closed = coverState !== 'open', locked = busy || coverBusy;
    const atStart = page <= frontBoundaryPage(), atEnd = page >= backBoundaryPage();
    const contentPage = page - firstContentPage;
    $('#current-chapter').hidden = closed;
    $('#current-chapter').textContent = endpaper ? endpaperTitle : (spread.chapter ? spread.chapter + '. ' : '') + spread.title;
    $('#page-count').textContent = closed ? (coverState === 'front' ? 'ТОМ I' : 'MMXXVI') : endpaper ? ''
      : mobileQuery.matches ? `${String(contentPage + 1).padStart(2, '0')} / ${spreads.length * 2}`
      : `${String(i + 1).padStart(2, '0')} / ${spreads.length}`;
    $('#prev').disabled = locked || coverState === 'front';
    $('#next').disabled = locked || coverState === 'back';
    $('#prev').setAttribute('aria-label', coverState === 'back' ? 'Открыть задний форзац' : atStart ? 'Закрыть переднюю обложку' : 'Предыдущий разворот');
    $('#next').setAttribute('aria-label', coverState === 'front' ? 'Открыть книгу' : atEnd ? 'Закрыть книгу' : 'Следующий разворот');
    $('#notes-open').disabled = closed || coverBusy || endpaper;
    const action = $('#cover-action');
    action.hidden = !closed && !atStart && !atEnd;
    action.disabled = locked;
    action.textContent = coverState === 'front' ? 'Открыть книгу →' : coverState === 'back' ? '← Открыть книгу' : 'Закрыть книгу';
    document.querySelectorAll('[data-spread]').forEach(b => b.setAttribute('aria-current', !closed && !endpaper && Number(b.dataset.spread) === i));
    document.querySelectorAll('[data-cover]').forEach(b => b.setAttribute('aria-current', b.dataset.cover === coverState));
    const label = closed ? (coverState === 'front' ? 'Передняя обложка' : 'Книга закрыта') : endpaper ? endpaperTitle : spread.title;
    $('#announce').textContent = closed || endpaper ? label : `${spread.title}. ${mobileQuery.matches ? 'Страница ' + (contentPage + 1) + ' из ' + (spreads.length * 2) : 'Разворот ' + (i + 1) + ' из ' + spreads.length}`;
    $('.navigation-hint').innerHTML = coverState === 'front' ? 'Нажмите на обложку или <kbd>→</kbd>' : coverState === 'back' ? '<kbd>←</kbd> Открыть книгу' : 'Листайте <kbd>←</kbd> <kbd>→</kbd> или потяните за угол';
    document.body.dataset.readerState = coverBusy ? 'cover-motion' : coverState;
    document.title = `${label} · Методы подготовки эксперта`;
    const hash = closed ? (coverState === 'front' ? '#cover' : '#back-cover') : endpaper
      ? page < firstContentPage ? '#front-endpaper' : '#back-endpaper'
      : '#' + spread.id + (mobileQuery.matches && page % 2 ? '/2' : '');
    try { history.replaceState(null, '', hash); } catch { /* file previews can restrict history */ }
  }
  function fitBook() {
    const room = $('#reading-room');
    const mobile = mobileQuery.matches;
    const width = mobile ? 560 : 1120;
    const scale = Math.max(.1, Math.min((room.clientWidth - (mobile ? 48 : 168)) / width, (room.clientHeight - 38) / 700, 1.35));
    const sizeKey = `${mobile}:${scale.toFixed(5)}`;
    if (lastSize === sizeKey) return;
    duelBurn?.finish();
    covers?.finish();
    bookMotion?.finish();
    lastSize = sizeKey;
    holder.style.width = width * scale + 'px';
    holder.style.height = 700 * scale + 'px';
    book.style.setProperty('--page-scale', scale);
    if (pageFlip) {
      pageFlip.getSettings().usePortrait = mobile;
      pageFlip.update();
      book.style.setProperty('--page-scale', pageFlip.getRender().getRect().pageWidth / 560);
      // Portrait view shows the stationary flyleaf; the board lining is offscreen.
      // Preserve that boundary through resize instead of exposing another leaf.
      const current = pageFlip.getCurrentPageIndex();
      const target = coverState === 'front' ? frontBoundaryPage() : coverState === 'back' ? backBoundaryPage()
        : Math.max(frontBoundaryPage(), Math.min(backBoundaryPage(), current));
      if (target !== current) pageFlip.turnToPage(target);
      page = pageFlip.getCurrentPageIndex();
      updateUI();
    }
    covers?.sync();
  }
  function turnTo(target, animate = true) {
    if (busy || coverBusy || !pageFlip) return;
    duelBurn?.finish();
    target = Math.max(frontBoundaryPage(), Math.min(backBoundaryPage(), target));
    if (!mobileQuery.matches) target -= target % 2;
    if (coverState !== 'open') {
      bookMotion?.suspend();
      const boundary = coverState === 'front' ? frontBoundaryPage() : backBoundaryPage();
      if (target === boundary) {
        pageFlip.turnToPage(target);
        covers.transition('open', animate);
      } else {
        // A chapter shortcut skips the physical opening, so a leather board
        // never turns over an unrelated chapter and changes its back face.
        covers.transition('open', false);
        pageFlip.turnToPage(target);
      }
      return;
    }
    if (target === page) return;
    if (!animate || reducedMotion.matches) {
      bookMotion?.suspend();
      pageFlip.turnToPage(target);
    } else pageFlip.flip(target, 'bottom');
  }
  function closeBook(side, animate = true) {
    if (busy || coverBusy || !covers || coverState === side) return;
    duelBurn?.finish();
    bookMotion.suspend();
    pageFlip.turnToPage(side === 'front' ? frontBoundaryPage() : backBoundaryPage());
    covers.transition(side, animate && coverState === 'open');
  }
  function activateCover() {
    if (coverState === 'front') turnTo(frontBoundaryPage());
    else if (coverState === 'back') turnTo(backBoundaryPage());
    else closeBook(page <= frontBoundaryPage() ? 'front' : 'back');
  }
  function next() {
    if (coverState === 'front') { turnTo(frontBoundaryPage()); return; }
    if (coverState === 'back') return;
    if (page >= backBoundaryPage()) closeBook('back');
    else turnTo(page + (mobileQuery.matches ? 1 : 2));
  }
  function prev() {
    if (coverState === 'back') { turnTo(backBoundaryPage()); return; }
    if (coverState === 'front') return;
    if (page <= frontBoundaryPage()) closeBook('front');
    else turnTo(page - (mobileQuery.matches ? 1 : 2));
  }
  $('#cover-action').addEventListener('click', activateCover);
  $('#next').addEventListener('click', next); $('#prev').addEventListener('click', prev);
  const progress = $('#progress'), toc = $('#toc-list');
  spreads.forEach((spread, i) => {
    const dot = document.createElement('button'); dot.dataset.spread = i;
    dot.title = `${i + 1}. ${spread.title}`; dot.setAttribute('aria-label', `Разворот ${i + 1}: ${spread.title}`);
    dot.addEventListener('click', () => turnTo(firstContentPage + i * 2)); progress.append(dot);
    const row = document.createElement('button'); row.dataset.spread = i;
    row.innerHTML = `<span class="toc-num">${String(i + 1).padStart(2, '0')}</span><span class="toc-title">${spread.title}</span><span class="toc-page">${i * 2 + 1}</span>`;
    row.addEventListener('click', () => { $('#toc-dialog').close(); turnTo(firstContentPage + i * 2); }); toc.append(row);
  });
  ['front', 'back'].forEach(side => {
    const dot = document.createElement('button');
    dot.dataset.cover = side;
    dot.className = 'cover-progress';
    dot.title = side === 'front' ? 'Передняя обложка' : 'Задняя обложка';
    dot.setAttribute('aria-label', dot.title);
    dot.addEventListener('click', () => closeBook(side));
    side === 'front' ? progress.prepend(dot) : progress.append(dot);
  });
  function openDialog(id) { if (!$(id).open) $(id).showModal(); }
  $('#toc-open').addEventListener('click', () => openDialog('#toc-dialog'));
  $('#help-open').addEventListener('click', () => openDialog('#help-dialog'));
  function openNotes() {
    if (coverState !== 'open' || coverBusy || isEndpaper(page)) return;
    const spread = spreads[contentIndex(page)];
    $('#note-title').textContent = spread.title;
    $('#note-text').value = storage.read('note:' + spread.id, spread.note);
    $('#note-text').dataset.id = spread.id;
    $('#save-status').textContent = 'Сохраняются в этом браузере';
    openDialog('#notes-dialog');
  }
  $('#notes-open').addEventListener('click', openNotes);
  $('#note-text').addEventListener('input', event => {
    const success = storage.write('note:' + event.target.dataset.id, event.target.value);
    $('#save-status').textContent = success ? 'Сохранено в этом браузере' : 'Хранилище недоступно — скопируйте текст';
  });
  $('#reset-note').addEventListener('click', () => {
    const s = spreads.find(s => s.id === $('#note-text').dataset.id);
    $('#note-text').value = s.note;
    const success = storage.write('note:' + s.id, s.note);
    $('#save-status').textContent = success ? 'Исходный текст восстановлен' : 'Хранилище недоступно — скопируйте текст';
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close(); } });
  });
  async function togglePresentation() {
    const entering = !document.body.classList.contains('presenting');
    document.body.classList.toggle('presenting', entering);
    $('#fullscreen').setAttribute('aria-pressed', entering);
    try { if (entering && !document.fullscreenElement) await document.documentElement.requestFullscreen(); else if (!entering && document.fullscreenElement) await document.exitFullscreen(); } catch { /* immersive layout still works in embedded previews */ }
    fitBook();
  }
  $('#fullscreen').addEventListener('click', togglePresentation);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { document.body.classList.remove('presenting'); $('#fullscreen').setAttribute('aria-pressed', 'false'); } fitBook(); });
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.code === 'Space' && !event.target.closest('button,a')) { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); prev(); }
    if (event.key === 'Home') { event.preventDefault(); closeBook('front'); }
    if (event.key === 'End') { event.preventDefault(); closeBook('back'); }
    if (event.code === 'KeyT') openDialog('#toc-dialog');
    if (event.code === 'KeyN') openNotes();
    if (event.code === 'KeyF') togglePresentation();
    if (event.key === 'Escape' && document.body.classList.contains('presenting')) togglePresentation();
  });
  book.addEventListener('click', event => {
    const button = event.target.closest('[data-check]'); if (!button || busy) return;
    checks[button.dataset.check] = !checks[button.dataset.check];
    document.querySelectorAll('[data-check="' + button.dataset.check + '"]').forEach(b => b.setAttribute('aria-pressed', checks[button.dataset.check]));
    storage.write('checks', checks);
  });
  window.addEventListener('hashchange', () => {
    const target = fromHash();
    covers?.finish();
    bookMotion?.suspend();
    if (target.state === 'open') turnTo(target.page, false);
    else closeBook(target.state, false);
  });
  $('.brand').addEventListener('click', event => { event.preventDefault(); closeBook('front'); });
  fitBook();
  const sheets = Array.from({ length: maxPage + 1 }, (_, pageNumber) => {
    const sheet = document.createElement('article');
    sheet.className = 'book-leaf';
    sheet.dataset.density = 'soft';
    sheet.dataset.page = pageNumber;
    const surface = document.createElement('div');
    surface.className = 'page ' + (pageNumber % 2 ? 'right-page' : 'left-page');
    fill(surface, pageNumber);
    sheet.append(surface); book.append(sheet); return sheet;
  });
  pageFlip = new St.PageFlip(book, {
    width: 560, height: 700, size: 'stretch', minWidth: 400, maxWidth: 800,
    minHeight: 100, maxHeight: 1000, autoSize: false, usePortrait: mobileQuery.matches,
    showCover: false, startPage: page, flippingTime: 1100, maxShadowOpacity: .30,
    drawShadow: true, mobileScrollSupport: false, showPageCorners: true,
    clickEventForward: true, useMouseEvents: false, swipeDistance: 30
  });
  pageFlip.on('flip', event => {
    page = event.data;
    // turnToPage is synchronous; animated turns settle on the following read event.
    if (motionState === 'read') { settledPage = page; incomingFoldPage = null; }
    updateUI();
  });
  pageFlip.on('changeState', event => {
    // Vendor emits this event before assigning its internal state.
    motionState = event.data;
    if (motionState === 'read') {
      settledPage = pageFlip.getCurrentPageIndex();
      incomingFoldPage = null;
    }
    busy = motionState === 'flipping' || motionState === 'user_fold';
    book.dataset.state = motionState;
    updateUI();
  });
  pageFlip.loadFromHTML(sheets);
  book.style.setProperty('--page-scale', pageFlip.getRender().getRect().pageWidth / 560);
  // Keep the spine in the renderer's layer stack: static paper (1), spine (2),
  // revealed paper (3), turning leaf (5). A sibling above #book covers every leaf.
  book.querySelector('.stf__block').append(holder.querySelector('.binding'));
  bookMotion = window.installBookMotion(pageFlip, book, reducedMotion, {
    onBeforeFold: () => duelBurn?.finish(),
    onFold: bottomPage => {
      const number = bottomPage?.getElement()?.dataset.page;
      incomingFoldPage = number == null ? null : Number(number);
      updateUI();
    },
    canBoundary: direction => coverState === 'open' && !coverBusy && (direction === 1 ? page <= frontBoundaryPage() : page >= backBoundaryPage()),
    onBoundary: direction => direction === 1 ? prev() : next()
  });
  covers = window.installBookCovers({
    holder, book, reducedMotion, isMobile: () => mobileQuery.matches,
    initialState: coverState,
    getPageSurface: side => sheets[side === 'front' ? 0 : maxPage].querySelector('.page'),
    getPageGeometry: () => pageFlip.getRender().getRect(),
    onChange: state => { coverState = state.state; coverBusy = state.busy; updateUI(); },
    onActivate: activateCover
  });
  duelBurn = window.installDuelBurn({
    root: book, reducedMotion,
    beforeActivate: () => {
      if (busy || coverBusy || coverState !== 'open') return false;
      bookMotion.suspend();
      return true;
    }
  });
  book.dataset.state ||= 'read';
  new ResizeObserver(fitBook).observe($('#reading-room'));
  render();
  document.fonts.ready.then(fitBook);
})();
