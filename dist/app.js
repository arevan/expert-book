(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ornament = `<svg class="ornament" viewBox="0 0 160 60" aria-hidden="true"><path d="M16 39c30 9 43-29 64-9 21-20 34 18 64 9M27 40c18 1 21-16 31-16M133 40c-18 1-21-16-31-16M80 44V13M80 31c-19 0-24-15-21-20 17 0 21 12 21 20Zm0 0c19 0 24-15 21-20-17 0-21 12-21 20ZM41 37c-12 1-16-7-15-12 11-1 16 6 15 12Zm78 0c12 1 16-7 15-12-11-1-16 6-15 12ZM68 44h24M75 49h10"/><circle cx="80" cy="9" r="3"/></svg>`;
  const title = {
    id: 'title', chapter: '', title: 'Титульный лист',
    left: `<figure class="plate"><img src="assets/cookbook-reference.png" alt="Старинная гравюра: повара за приготовлением блюд в большой кухне" draggable="false"></figure><p class="plate-caption">Искусство превращать замысел в дело.</p>`,
    right: `<p class="title-eyebrow">Настольная книга<br>продуктового дизайнера</p><h1>Методы<span class="minor">подготовки</span>эксперта</h1><p class="subtitle">О видении, мастерстве<br>и ответственности за целое</p>${ornament}<p class="title-credit">В пяти главах,<br>с наблюдениями и практическими советами</p><div class="colophon"><p>От сильного senior — к эксперту</p><p class="date">MMXXVI</p></div>`,
    note: 'Начните с вопроса аудитории: «Что, по-вашему, делает эксперт, когда не рисует концепты?» Соберите несколько ответов. Сегодня обсуждаем модель роли, которую мы внедряли в банке. Главная мысль: эксперт соединяет видение группы продуктов, высокую планку мастерства и влияние на решения команды. Путь к мастерству — образ развития качеств и ответственности эксперта. На следующем развороте расскажите вашу историю появления роли.'
  };
  const spreads = [title, ...(window.BOOK_CONTENT || [])];
  const book = $('#book'), holder = $('#book-holder');
  let pageFlip, bookMotion;
  const mobileQuery = matchMedia('(max-width: 700px)'), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const maxPage = spreads.length * 2 - 1;
  let page = 0, busy = false, lastSize = "";
  const storage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem('expert-cookbook:' + key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem('expert-cookbook:' + key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const checks = storage.read('checks', {});
  function fromHash() {
    const raw = location.hash.slice(1).split('/');
    const i = spreads.findIndex(s => s.id === raw[0]);
    return i < 0 ? 0 : i * 2 + (mobileQuery.matches && raw[1] === '2' ? 1 : 0);
  }
  page = fromHash();
  function markChecks(el) {
    el.querySelectorAll('[data-check]').forEach(button => { button.setAttribute('aria-pressed', !!checks[button.dataset.check]); button.setAttribute('aria-label', button.textContent.trim()); });
  }
  function fill(el, pageNumber) {
    const spread = spreads[Math.floor(pageNumber / 2)];
    const isRight = pageNumber % 2 === 1;
    el.classList.toggle('title-page', pageNumber === 1);
    el.classList.toggle('frontispiece', pageNumber === 0);
    el.classList.toggle('chapter-art-page', pageNumber >= 2 && !isRight);
    el.classList.toggle('chapter-text-page', pageNumber >= 2 && isRight);
    el.setAttribute('aria-label', `Страница ${pageNumber + 1}: ${spread.title}`);
    el.innerHTML = `<div class="running"><span>${pageNumber < 2 ? 'ARS · DESIGN' : 'Методы подготовки эксперта'}</span><span>${spread.chapter ? 'ГЛАВА ' + spread.chapter : 'Том первый'}</span></div><div class="page-content">${isRight ? spread.right : spread.left}</div><div class="folio" aria-hidden="true">${pageNumber + 1}</div>`;
    markChecks(el);
  }
  function render() { updateUI(); }
  function updateUI() {
    const i = Math.floor(page / 2), spread = spreads[i];
    $('#current-chapter').textContent = (spread.chapter ? spread.chapter + '. ' : '') + spread.title;
    $('#page-count').textContent = mobileQuery.matches ? `${String(page + 1).padStart(2, '0')} / ${maxPage + 1}` : `${String(i + 1).padStart(2, '0')} / ${spreads.length}`;
    const atStart = page === 0, atEnd = mobileQuery.matches ? page === maxPage : i === spreads.length - 1;
    [$('#prev')].forEach(b => b.disabled = atStart || busy);
    [$('#next')].forEach(b => b.disabled = atEnd || busy);
    document.querySelectorAll('[data-spread]').forEach(b => b.setAttribute('aria-current', Number(b.dataset.spread) === i));
    $('#announce').textContent = `${spread.title}. ${mobileQuery.matches ? 'Страница ' + (page + 1) + ' из ' + (maxPage + 1) : 'Разворот ' + (i + 1) + ' из ' + spreads.length}`;
    document.title = `${spread.title} · Методы подготовки эксперта`;
    const hash = '#' + spread.id + (mobileQuery.matches && page % 2 ? '/2' : '');
    try { history.replaceState(null, '', hash); } catch { /* file previews can restrict history */ }
  }
  function fitBook() {
    const room = $('#reading-room');
    const mobile = mobileQuery.matches;
    const width = mobile ? 560 : 1120;
    const scale = Math.max(.1, Math.min((room.clientWidth - (mobile ? 48 : 168)) / width, (room.clientHeight - 38) / 700, 1.35));
    const sizeKey = `${mobile}:${scale.toFixed(5)}`;
    if (lastSize === sizeKey) return;
    bookMotion?.finish();
    lastSize = sizeKey;
    holder.style.width = width * scale + 'px';
    holder.style.height = 700 * scale + 'px';
    book.style.setProperty('--page-scale', scale);
    if (pageFlip) {
      pageFlip.getSettings().usePortrait = mobile;
      pageFlip.update();
      page = pageFlip.getCurrentPageIndex();
      updateUI();
    }
  }
  function turnTo(target, animate = true) {
    if (busy || !pageFlip) return;
    target = Math.max(0, Math.min(maxPage, target));
    if (!mobileQuery.matches) target -= target % 2;
    if (target === page) return;
    if (!animate || reducedMotion.matches) pageFlip.turnToPage(target);
    else pageFlip.flip(target, 'bottom');
  }
  function next() { turnTo(page + (mobileQuery.matches ? 1 : 2)); }
  function prev() { turnTo(page - (mobileQuery.matches ? 1 : 2)); }
  $('#next').addEventListener('click', next); $('#prev').addEventListener('click', prev);
  const progress = $('#progress'), toc = $('#toc-list');
  spreads.forEach((spread, i) => {
    const dot = document.createElement('button'); dot.dataset.spread = i;
    dot.title = `${i + 1}. ${spread.title}`; dot.setAttribute('aria-label', `Разворот ${i + 1}: ${spread.title}`);
    dot.addEventListener('click', () => turnTo(i * 2)); progress.append(dot);
    const row = document.createElement('button'); row.dataset.spread = i;
    row.innerHTML = `<span class="toc-num">${String(i + 1).padStart(2, '0')}</span><span class="toc-title">${spread.title}</span><span class="toc-page">${i * 2 + 1}</span>`;
    row.addEventListener('click', () => { $('#toc-dialog').close(); turnTo(i * 2); }); toc.append(row);
  });
  function openDialog(id) { if (!$(id).open) $(id).showModal(); }
  $('#toc-open').addEventListener('click', () => openDialog('#toc-dialog'));
  $('#help-open').addEventListener('click', () => openDialog('#help-dialog'));
  function openNotes() {
    const spread = spreads[Math.floor(page / 2)];
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
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.code === 'Space' && event.target === document.body) { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); prev(); }
    if (event.key === 'Home') { event.preventDefault(); turnTo(0); }
    if (event.key === 'End') { event.preventDefault(); turnTo(maxPage); }
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
  window.addEventListener('hashchange', () => turnTo(fromHash(), false));
  $('.brand').addEventListener('click', event => { event.preventDefault(); turnTo(0); });
  fitBook();
  const sheets = spreads.flatMap((spread, i) => [0, 1].map(side => {
    const sheet = document.createElement('article');
    sheet.className = 'book-leaf';
    sheet.dataset.density = 'soft';
    sheet.dataset.page = i * 2 + side;
    const surface = document.createElement('div');
    surface.className = 'page ' + (side ? 'right-page' : 'left-page');
    fill(surface, i * 2 + side);
    sheet.append(surface); book.append(sheet); return sheet;
  }));
  pageFlip = new St.PageFlip(book, {
    width: 560, height: 700, size: 'stretch', minWidth: 400, maxWidth: 800,
    minHeight: 100, maxHeight: 1000, autoSize: false, usePortrait: mobileQuery.matches,
    showCover: false, startPage: page, flippingTime: 1100, maxShadowOpacity: .24,
    drawShadow: true, mobileScrollSupport: false, showPageCorners: true,
    clickEventForward: true, useMouseEvents: false, swipeDistance: 30
  });
  pageFlip.on('flip', event => {
    page = event.data; updateUI();
  });
  pageFlip.on('changeState', event => {
    busy = event.data === 'flipping' || event.data === 'user_fold';
    book.dataset.state = event.data;
    updateUI();
  });
  pageFlip.loadFromHTML(sheets);
  // Keep the spine in the renderer's layer stack: static paper (1), spine (2),
  // revealed paper (3), turning leaf (5). A sibling above #book covers every leaf.
  book.querySelector('.stf__block').append(holder.querySelector('.binding'));
  bookMotion = window.installBookMotion(pageFlip, book, reducedMotion);
  new ResizeObserver(fitBook).observe($('#reading-room'));
  render();
  document.fonts.ready.then(fitBook);
})();
