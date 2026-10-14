(() => {
  // One spread per chapter. The author will supply the final chapter texts.
  const illustration = (asset, description, caption) => `
    <figure class="chapter-illustration">
      <div class="chapter-plate">
        <img src="assets/${asset}" alt="${description}" draggable="false">
      </div>
      <figcaption>${caption}</figcaption>
    </figure>`;
  const pendingIllustration = (chapter, subject, caption) => `
    <figure class="chapter-illustration">
      <div class="chapter-plate chapter-plate-pending" role="img" aria-label="Гравюра к главе ${chapter} будет подготовлена отдельно: ${subject.replace(/<br>/g, ' ')}">
        <p class="plate-label">Гравюра к главе</p>
        <p class="plate-mark" aria-hidden="true">${chapter}</p>
        <p class="plate-subject">${subject}</p>
        <p class="plate-placeholder-note">Будет подготовлена отдельно</p>
      </div>
      <figcaption>${caption}</figcaption>
    </figure>`;
  const chapterText = (chapter, title, subtitle, outline) => `
    <p class="kicker">Глава ${chapter}</p>
    <h2 class="chapter-heading">${title}</h2>
    ${subtitle ? `<p class="chapter-subtitle">${subtitle}</p>` : ''}
    <div class="chapter-divider" aria-hidden="true">✦</div>
    <p class="draft-label">Предварительный набросок</p>
    <ul class="chapter-outline">${outline.map(item => `<li>${item}</li>`).join('')}</ul>
    `;
  window.BOOK_CONTENT = [
    {
      id: 'origins', chapter: 'I', title: 'История возникновения',
      left: `<figure class="chapter-illustration"><div class="chapter-plate"><img src="assets/origins-map-v2.png" alt="Старинная карта дизайнерских земель: Junior Designer, Middle Designer, Senior, Lead, Head of Design и Expert Designer. Путь Junior → Middle → Senior; затем ветви Lead и Expert. Внизу два картографа." draggable="false"></div><figcaption>Карта дизайнерских земель.</figcaption></figure>`,
      right: chapterText('I', 'История<br>возникновения', 'Как мы с Серёгой затащили первые драфты', [
        'С чего начался разговор о новой роли.',
        'Какими были первые драфты.',
        'Как складывалось понимание эксперта.'
      ]),
      note: 'Место для вашей истории: как вы с Серёгой пришли к идее роли, что было в первых драфтах и как вы их обсуждали. Здесь пока только план — факты, эпизоды и выводы добавит автор.'
    },
    {
      id: 'composition', chapter: 'II', title: 'Добродетели эксперта',
      left: illustration('virtues-engraving-v1.png', 'Старинная гравюра: ангел с нимбом возвышается над людьми и помогает им в общем деле.', 'О качествах, которые приносят пользу другим.'),
      right: chapterText('II', 'Добродетели<br>эксперта', 'Из каких качеств складывается эксперт', [
        'Концептуальное и продуктовое мышление.',
        'Мастерство визуала и взаимодействия.',
        'Эмпатия, исследование и проверка идей.',
        'Инициатива и влияние через мастерство.'
      ]),
      note: 'Предварительный план главы о качествах эксперта. Общая основа: концептуальное и продуктовое мышление, сильный визуал и взаимодействие, эмпатия и исследования, инициатива и влияние. У каждого эксперта могут быть свои сильные стороны и пропорции этих качеств. Личные примеры и окончательные формулировки добавит автор.'
    },
    {
      id: 'roles', chapter: 'III', title: 'Рыцари круглого стола',
      left: illustration('roundtable-engraving-v1.png', 'Старинная гравюра: героиня-эксперт в рыцарских доспехах обсуждает общий план с двумя рыцарями за круглым столом. На её щите — исторический герб Тинькофф, на пергаменте — варианты A и B.', 'Разные роли в общем деле.'),
      right: chapterText('III', 'Рыцари<br>круглого стола', 'Чем эксперт отличается<br>от синьора и лида', [
        'Senior: самостоятельность и сильные решения.',
        'Эксперт: видение и качество группы продуктов.',
        'Лид: команда, ресурсы и организация работы.',
        'Как разные роли дополняют друг друга.'
      ]),
      note: 'Предварительный план сравнения senior, эксперта и лида. Здесь важно показать разницу в масштабе и фокусе, а также общую работу ролей. Примеры и формулировки добавит автор.'
    },
    {
      id: 'delivery', chapter: 'IV', title: 'Испытание боем',
      left: `<figure class="chapter-illustration">
        <button class="chapter-plate duel-plate" type="button" data-duel-burn aria-describedby="duel-scene" aria-label="Сжечь гравюру и открыть второй кадр боя">
          <span class="duel-art">
            <img class="duel-after" src="assets/studies/duel-strike-v1.png" alt="" aria-hidden="true" draggable="false">
            <img class="duel-before" src="assets/studies/duel-windup-v1.png" alt="" aria-hidden="true" draggable="false">
            <canvas hidden aria-hidden="true"></canvas>
          </span>
          <span class="duel-cue" aria-hidden="true">Нажмите на гравюру</span>
        </button>
        <figcaption>Отстоять замысел и довести его до результата.</figcaption>
        <span id="duel-scene" class="sr-only">Героиня-рыцарь справа и рыцарь в чёрных доспехах слева замахиваются мечами. На её щите герб Тинькофф, на щите противника косматый бес.</span>
        <span class="sr-only duel-status" role="status" aria-live="polite"></span>
      </figure>`,
      right: chapterText('IV', 'Испытание боем', 'От замысла до результата', [
        'Диалог с бизнесом о пользе для пользователя.',
        'Как отстоять видение в диалоге с бизнесом.',
        'Сопровождение решения от концепта до продакшена.',
        'Проверка и сохранение качества в реализации.'
      ]),
      note: 'Предварительный план главы об ответственности эксперта. Эксперт обсуждает решение с бизнесом и командой, связывает его с пользой для пользователя, работает с ограничениями и сопровождает концепт до качественного продакшена. Примеры диалога, компромиссов и результатов добавит автор.'
    },
    {
      id: 'defense', chapter: 'V', title: 'Перед советом ордена',
      left: illustration('council-engraving-v2.png', 'Старинная гравюра: героиня-рыцарь стоит спиной к зрителю и защищает работу перед тремя членами комиссии за высокой кафедрой на возвышении. Комиссия спорит и задаёт вопросы.', 'Признание мастерства и ответственности.'),
      right: chapterText('V', 'Перед советом<br>ордена', 'Защита на роль эксперта', [
        'Работы, показывающие готовность к роли.',
        'Масштаб задач, самостоятельность и влияние.',
        'Аргументация решений и полученный результат.',
        'Подготовка к вопросам и обсуждению.'
      ]),
      note: 'Предварительный план главы о защите на роль эксперта. Предмет обсуждения — реальные работы и примеры, подтверждающие готовность действовать в масштабе роли. Критерии, состав коллегии и фактический порядок защиты в банке добавит автор; этот набросок не описывает установленную процедуру.'
    }
  ];
})();
