(() => {
  'use strict';
  // Approved presentation theses. Keep one engraving/text spread per chapter.
  const escapeHTML = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const proseHTML = text => escapeHTML(text).replaceAll("1–2 года", '<span class="keep-together">1–2 года</span>');
  const chapterText = chapter => `<section class="chapter-copy${chapter.entries ? ' chapter-copy--entries' : ''}${chapter.closing ? ' chapter-copy--closing' : ''}">
    <p class="kicker">Глава ${chapter.chapter}</p>
    <h2 class="chapter-heading">${chapter.heading.map(escapeHTML).join('<br>')}</h2>
    <p class="chapter-subtitle">${escapeHTML(chapter.subtitle)}</p>
    <div class="chapter-divider" aria-hidden="true">✦</div>
    ${chapter.entries
      ? '<dl class="chapter-entries">' + chapter.entries.map(entry => '<div><dt>' + escapeHTML(entry.title) + '</dt><dd>' + proseHTML(entry.text) + '</dd></div>').join('') + '</dl>'
      : '<ul class="chapter-outline">' + chapter.theses.map(text => '<li>' + escapeHTML(text) + '</li>').join('') + '</ul>'}
    ${chapter.closing ? '<p class="chapter-closing">' + escapeHTML(chapter.closing) + '</p>' : ''}
  </section>`;
  const chapters = [
  {
    "id": "origins",
    "chapter": "I",
    "title": "История возникновения",
    "heading": [
      "История",
      "возникновения"
    ],
    "subtitle": "Два запроса — одна новая роль",
    "entries": [
      {
        "title": "Экспертная ветка роста",
        "text": "Путь развития для сеньоров, которые хотят сохранять фокус на дизайне."
      },
      {
        "title": "Фокус на будущем",
        "text": "Внимание к тому, каким станет продукт через 1–2 года."
      },
      {
        "title": "Ответственность за направление",
        "text": "Эксперт формирует вижн группы продуктов и поддерживает общую планку качества."
      }
    ],
    "left": "<figure class=\"chapter-illustration\"><div class=\"chapter-plate\"><img src=\"assets/origins-map-v2.png\" alt=\"Старинная карта дизайнерских земель: Junior Designer, Middle Designer, Senior, Lead, Head of Design и Expert Designer. Путь Junior → Middle → Senior; затем ветви Lead и Expert. Внизу два картографа.\" draggable=\"false\"></div><figcaption>Карта дизайнерских земель.</figcaption></figure>"
  },
  {
    "id": "composition",
    "chapter": "II",
    "title": "Добродетели эксперта",
    "heading": [
      "Добродетели",
      "эксперта"
    ],
    "subtitle": "Из каких качеств складывается эксперт",
    "theses": [
      "Сильное продуктовое и концептуальное мышление.",
      "Дизайнерское мастерство.",
      "Инициатива и автономность.",
      "Способность продать и защитить решение.",
      "Ответственность за результат.",
      "Способность развивать других дизайнеров."
    ],
    "left": "\n    <figure class=\"chapter-illustration\">\n      <div class=\"chapter-plate\">\n        <img src=\"assets/virtues-engraving-v1.png\" alt=\"Старинная гравюра: ангел с нимбом возвышается над людьми и помогает им в общем деле.\" draggable=\"false\">\n      </div>\n      <figcaption>О качествах, которые приносят пользу другим.</figcaption>\n    </figure>"
  },
  {
    "id": "roles",
    "chapter": "III",
    "title": "Рыцари круглого стола",
    "heading": [
      "Рыцари",
      "круглого стола"
    ],
    "subtitle": "Масштаб ответственности и фокус работы",
    "entries": [
      {
        "title": "Сеньор",
        "text": "Самостоятельное ведение сложных задач и результат в своём продукте."
      },
      {
        "title": "Эксперт",
        "text": "Долгосрочный вижн группы продуктов или отдела, общее направление и качество дизайна."
      },
      {
        "title": "Лид",
        "text": "Состав и развитие команды, распределение нагрузки и организация взаимодействия."
      }
    ],
    "closing": "Все роли должны дополнять друг друга",
    "left": "\n    <figure class=\"chapter-illustration\">\n      <div class=\"chapter-plate\">\n        <img src=\"assets/roundtable-engraving-v1.png\" alt=\"Старинная гравюра: героиня-эксперт в рыцарских доспехах обсуждает общий план с двумя рыцарями за круглым столом. На её щите — исторический герб Тинькофф, на пергаменте — варианты A и B.\" draggable=\"false\">\n      </div>\n      <figcaption>Разные роли в общем деле.</figcaption>\n    </figure>"
  },
  {
    "id": "delivery",
    "chapter": "IV",
    "title": "Испытание боем",
    "heading": [
      "Испытание боем"
    ],
    "subtitle": "От замысла до результата",
    "theses": [
      "Понимать задачи бизнеса и ограничения команды.",
      "Отстаивать решения аргументами и быть готовым пересматривать их.",
      "Договариваться о компромиссах, сохраняя ценность для пользователя.",
      "Сопровождать ключевые решения до прода.",
      "Проверять результат после запуска."
    ],
    "left": "<figure class=\"chapter-illustration\" data-book-interactive>\n        <button class=\"chapter-plate duel-plate\" type=\"button\" data-duel-burn aria-describedby=\"duel-scene\" aria-label=\"Нажмите на гравюру\">\n          <span class=\"duel-art\">\n            <img class=\"duel-frame\" src=\"assets/studies/duel-windup-v1.png\" data-description=\"Героиня-рыцарь справа и рыцарь в чёрных доспехах слева замахиваются мечами. На её щите герб Тинькофф, на щите противника косматый бес.\" alt=\"\" aria-hidden=\"true\" draggable=\"false\">\n            <img class=\"duel-frame\" src=\"assets/studies/duel-negotiation-v1.png\" data-description=\"Героиня беседует с лохматым бесом. Он предлагает: «Давай откажемся от всех анимаций, чтобы уложиться в сроки».\" alt=\"\" aria-hidden=\"true\" draggable=\"false\" hidden>\n            <img class=\"duel-frame\" src=\"assets/studies/duel-strike-v1.png\" data-description=\"Чёрный рыцарь наносит удар мечом в бок героини. Она остаётся на ногах с поднятым мечом. Гравюра без крови.\" alt=\"\" aria-hidden=\"true\" draggable=\"false\" hidden>\n            <canvas hidden aria-hidden=\"true\"></canvas>\n          </span>\n          <span class=\"duel-cue\" aria-hidden=\"true\">Нажмите на гравюру</span>\n        </button>\n        <figcaption>Отстоять замысел и довести его до результата.</figcaption>\n        <span id=\"duel-scene\" class=\"sr-only\">Героиня-рыцарь справа и рыцарь в чёрных доспехах слева замахиваются мечами. На её щите герб Тинькофф, на щите противника косматый бес.</span>\n        <span class=\"sr-only duel-status\" role=\"status\" aria-live=\"polite\"></span>\n      </figure>"
  },
  {
    "id": "defense",
    "chapter": "V",
    "title": "Перед советом ордена",
    "heading": [
      "Перед советом",
      "ордена"
    ],
    "subtitle": "Защита на роль эксперта",
    "theses": [
      "Понимание проблемы, пользователя и задач бизнеса.",
      "Личный вклад и самостоятельность.",
      "Обоснованность решений и проверка гипотез.",
      "Работа с ограничениями и разногласиями.",
      "Реализация, результат и выводы.",
      "Масштаб влияния на продукты и других дизайнеров."
    ],
    "left": "\n    <figure class=\"chapter-illustration\">\n      <div class=\"chapter-plate\">\n        <img src=\"assets/council-engraving-v2.png\" alt=\"Старинная гравюра: героиня-рыцарь стоит спиной к зрителю и защищает работу перед тремя членами комиссии за высокой кафедрой на возвышении. Комиссия спорит и задаёт вопросы.\" draggable=\"false\">\n      </div>\n      <figcaption>Признание мастерства и ответственности.</figcaption>\n    </figure>"
  }
];
  window.BOOK_CONTENT = chapters.map(chapter => ({
    id: chapter.id, chapter: chapter.chapter, title: chapter.title,
    left: chapter.left, right: chapterText(chapter),
    note: [chapter.title, chapter.subtitle, ...(chapter.entries
      ? chapter.entries.map(entry => entry.title + '. ' + entry.text)
      : chapter.theses), chapter.closing].filter(Boolean).join('\n\n')
  }));
})();
