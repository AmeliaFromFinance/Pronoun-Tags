/*
 * Pronoun Tags for Twitch: settings, used by the toolbar popup and the options tab.
 *
 * Every change is saved straight away to extension storage, where open Twitch tabs pick it up without a reload.
 * The preview at the top uses the same formatting (look.js) and stylesheet (content.css) as the real tags.
 */
(() => {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const LOOK = PronounLook;
  const IN_TAB = document.documentElement.classList.contains('page');
  const SETTINGS_URL = 'https://pr.alejo.io';

  function t(key, vars) {
    let text = '';
    try { text = ext.i18n.getMessage(key); } catch (error) { /* outside the extension */ }
    text = text || key;
    for (const name in vars || {}) text = text.split(`{${name}}`).join(vars[name]);
    return text;
  }

  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(props || {})) {
      if (value == null || value === false) continue;
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name === 'style') for (const key in value) node.style.setProperty(key, value[key]);
      else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children.flat(Infinity)) if (child != null && child !== false) node.append(child.nodeType ? child : String(child));
    return node;
  }

  /* ---- State and saving ---- */

  let look = LOOK.clean(null);
  let theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';   // the preview's Twitch theme
  const syncers = [];                       // each brings one part of the page up to date with `look`
  const sync = () => syncers.forEach(update => update());

  const recentSaves = [];                   // our own writes, so their echo from storage.onChanged is ignored
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const write = () => {
      recentSaves.push(JSON.stringify(look));
      if (recentSaves.length > 8) recentSaves.shift();
      Promise.resolve(ext.storage.local.set({ look })).catch(() => {});
    };
    if (now) write(); else saveTimer = setTimeout(write, 150);
  }

  // `now: false` for things that change many times a second (dragging the size slider or a color).
  function change(changes, { now = true } = {}) {
    look = LOOK.clean({ ...look, ...changes });
    sync();
    save(now);
  }

  /* ---- Preview ---- */

  const SAMPLE_LINES = [
    { name: 'SleepySprout', color: '#FF69B4', parts: ['She', 'Her'], text: 'hi chat!', badge: '#9147FF' },
    { name: 'TofuWizard', color: '#1E90FF', parts: ['He', 'They'], text: 'gg', badge: '#00AD03' },
    { name: 'MossyLantern', color: '#00C8AF', parts: ['Any'], text: 'o7' },
    { name: null, color: '#DAA520', parts: ['They', 'Them'], text: 'hello!', own: true },
  ];

  // Twitch darkens name colors in its light theme so they stay readable; roughly the same here.
  const nameColor = color => (theme === 'light' ? `color-mix(in srgb, ${color} 72%, #000)` : color);

  function sampleTag(parts, settings, { color = null, heading = false } = {}) {
    const tag = h(settings.link ? 'a' : 'span', {
      class: heading ? 'pn-tag pn-tag--heading' : 'pn-tag', href: settings.link ? SETTINGS_URL : null,
      text: LOOK.format(parts, settings), onclick: event => event.preventDefault(), tabindex: settings.link ? '-1' : null,
    });
    if (color) tag.style.setProperty('--pn-name', color);
    return tag;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2.5M12 19.5V22M4.2 4.2 6 6M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
    out: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    tab: 'M4 5h16v14H4zM4 9h16',
    reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
    check: 'm6 12.5 4 4 8-9',
  };
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `icon icon-${name}`);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  }

  // A few lines of chat as they'd look on Twitch, with a button for Twitch's dark or light theme.
  function previewCard() {
    const preview = h('div', { class: 'pv', role: 'img', 'aria-label': t('preview') });
    syncers.push(() => {
      preview.className = `pv tw-root--theme-${theme}`;
      LOOK.apply(preview, look);
      const lines = SAMPLE_LINES.map(line => {
        const color = nameColor(line.color);
        const show = look.on && look.chat && (look.own || !line.own);
        const tag = show ? sampleTag(line.parts, look, { color }) : null;
        return h('div', { class: 'pv-line' },
          line.badge ? h('span', { class: 'pv-badge', style: { background: line.badge } }) : null,
          look.place === 'before' ? tag : null,
          h('span', { class: 'pv-name', style: { color }, text: line.name || t('previewYou') }),
          look.place === 'after' ? tag : null,
          `: ${line.text}`);
      });
      const about = h('div', { class: 'pv-about' }, t('previewAbout', { channel: 'SleepySprout' }),
        look.on && look.about ? sampleTag(['She', 'Her'], look, { heading: true }) : null);
      preview.replaceChildren(...lines, about);
    });

    // Twitch has a light theme too; the preview can show either, whatever this page's own colors are.
    const themeButton = h('button', { type: 'button', class: 'pv-theme', 'data-key': 'theme-light',
      'aria-label': t('previewLightTheme'), title: t('previewLightTheme') });
    themeButton.addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light';
      Promise.resolve(ext.storage.local.set({ previewTheme: theme })).catch(() => {});
      sync();
    });
    syncers.push(() => {
      themeButton.setAttribute('aria-pressed', String(theme === 'light'));
      themeButton.replaceChildren(icon(theme === 'light' ? 'sun' : 'moon'));
    });
    return h('div', { class: 'preview-card' }, preview, themeButton);
  }

  /* ---- Controls ---- */

  // The ready-made styles as tiles, each showing its tag on a scrap of chat.
  function styleTiles() {
    const tiles = Object.keys(LOOK.PRESETS).map(name => {
      const sample = h('span', { class: 'tile-sample', 'aria-hidden': 'true' });
      const tile = h('button', { type: 'button', class: 'tile', 'data-key': `preset:${name}`, onclick: () => change(LOOK.PRESETS[name]) },
        sample, h('span', { class: 'tile-name', text: t(`preset_${name}`) }), h('span', { class: 'tile-check' }, icon('check')));
      syncers.push(() => {
        const settings = { ...look, ...LOOK.PRESETS[name], place: 'after', link: false };
        sample.className = `tile-sample tw-root--theme-${theme}`;
        LOOK.apply(sample, settings);
        sample.replaceChildren(sampleTag(['She', 'Her'], settings, { color: nameColor('#FF69B4') }));
        tile.setAttribute('aria-pressed', String(LOOK.presetMatches(look, name)));
      });
      return tile;
    });
    return [h('h2', { class: 'group-label', id: 'styles-label', text: t('styles') }),
      h('div', { class: 'tiles', role: 'group', 'aria-labelledby': 'styles-label' }, tiles)];
  }

  // A labelled card of rows, the way phone settings group them.
  const group = (labelKey, ...rows) => [
    labelKey ? h('h2', { class: 'group-label', text: t(labelKey) }) : null,
    h('div', { class: 'group' }, rows),
  ];

  const rowText = (labelKey, subKey, forId) => h('span', { class: 'row-text' },
    h(forId ? 'label' : 'span', { class: 'row-label', for: forId, text: t(labelKey) }),
    subKey ? h('span', { class: 'row-sub', text: t(subKey) }) : null);

  function switchInput(key, label) {
    const input = h('input', { type: 'checkbox', role: 'switch', class: 'switch-input', 'data-key': key, 'aria-label': label });
    input.addEventListener('change', () => change({ [key]: input.checked }));
    syncers.push(() => { input.checked = look[key]; });
    return [input, h('span', { class: 'switch', 'aria-hidden': 'true' })];
  }
  const switchRow = (key, labelKey, subKey) => h('label', { class: 'row' }, rowText(labelKey, subKey), switchInput(key));

  // A drop-down for one of look.js's choices. `optionText` writes each option: an example, or a translated name.
  function selectRow(key, labelKey, optionText) {
    const id = `field-${key}`;
    const select = h('select', { id, 'data-key': key },
      LOOK.CHOICES[key].map(value => h('option', { value, text: optionText(value) })));
    select.addEventListener('change', () => change({ [key]: select.value }));
    syncers.push(() => { if (select.value !== look[key]) select.value = look[key]; });
    return h('div', { class: 'row' }, rowText(labelKey, null, id), h('span', { class: 'controls' }, select));
  }
  const example = changes => LOOK.format(['She', 'Her'], { ...LOOK.DEFAULTS, ...changes });

  // A color picker plus a hex box (the picker can't always open from a popup, and some people know their hex code).
  // Shown while `choiceKey` is set to "custom".
  function colorRow(key, choiceKey, labelKey) {
    const setting = t(labelKey);
    const swatch = h('input', { type: 'color', class: 'swatch', 'data-key': `${key}:swatch`,
      'aria-label': t('pickColor', { setting }), title: t('pickColor', { setting }) });
    const hex = h('input', { type: 'text', class: 'hex', 'data-key': `${key}:hex`, maxlength: '7', spellcheck: 'false',
      autocomplete: 'off', 'aria-label': t('hexLabel', { setting }) });
    swatch.addEventListener('input', () => change({ [key]: swatch.value }, { now: false }));
    hex.addEventListener('input', () => {
      const value = (hex.value.trim().startsWith('#') ? '' : '#') + hex.value.trim();
      const valid = /^#[0-9a-f]{6}$/i.test(value);
      if (valid) change({ [key]: value }, { now: false });
      hex.setAttribute('aria-invalid', String(!valid && value.length >= 7));
    });
    hex.addEventListener('change', () => { hex.value = look[key]; hex.removeAttribute('aria-invalid'); });
    const row = h('div', { class: 'row color-row' }, h('span', { class: 'controls' }, swatch, hex));
    syncers.push(() => {
      row.hidden = look[choiceKey] !== 'custom';
      if (swatch.value.toUpperCase() !== look[key]) swatch.value = look[key].toLowerCase();
      if (document.activeElement !== hex && hex.value !== look[key]) hex.value = look[key];
    });
    return row;
  }

  function sizeRow() {
    const range = h('input', { type: 'range', id: 'field-size', 'data-key': 'size',
      min: String(LOOK.SIZE.min), max: String(LOOK.SIZE.max), step: String(LOOK.SIZE.step) });
    const output = h('output', { for: 'field-size' });
    range.addEventListener('input', () => change({ size: Number(range.value) }, { now: false }));
    range.addEventListener('change', () => save(true));
    syncers.push(() => {
      if (Number(range.value) !== look.size) range.value = String(look.size);
      output.textContent = `${look.size}%`;
    });
    return h('div', { class: 'row' }, rowText('size', 'sizeSub', 'field-size'), h('span', { class: 'controls slider' }, range, output));
  }

  // Links and actions, as rows at the end of the settings.
  function actions() {
    // Two clicks to reset, so a stray one can't wipe out a style someone spent a while on.
    let armed = null;
    const resetText = h('span', { class: 'row-text', text: t('reset') });
    const reset = h('button', { type: 'button', class: 'row action danger', 'data-key': 'reset' }, icon('reset'), resetText);
    reset.addEventListener('click', () => {
      if (!armed) {
        resetText.textContent = t('resetConfirm');
        armed = setTimeout(() => { armed = null; resetText.textContent = t('reset'); }, 4000);
        return;
      }
      clearTimeout(armed); armed = null; resetText.textContent = t('reset');
      change({ ...LOOK.DEFAULTS });
    });
    const openTab = IN_TAB ? null : h('button', { type: 'button', class: 'row action', 'data-key': 'open-tab',
      onclick: () => { Promise.resolve(ext.runtime.openOptionsPage()).catch(() => {}); window.close(); } },
      icon('tab'), h('span', { class: 'row-text', text: t('openTab') }));
    const own = h('a', { class: 'row action', href: SETTINGS_URL, target: '_blank', rel: 'noopener noreferrer', 'data-key': 'set-own' },
      icon('out'), h('span', { class: 'row-text', text: t('setOwn') }));
    return [h('div', { class: 'group actions' }, own, openTab, reset), h('p', { class: 'note', text: t('note') })];
  }

  /* ---- The page ---- */

  const TABS = ['style', 'text', 'where'];
  let tab = 'style';

  function build() {
    const panels = {
      style: [
        styleTiles(),
        group('sectionColors',
          selectRow('color', 'color', value => t(`color_${value}`)),
          colorRow('customColor', 'color', 'color'),
          selectRow('background', 'background', value => t(`bg_${value}`)),
          colorRow('customBackground', 'background', 'background'),
          switchRow('border', 'outline')),
        group('sectionShape',
          selectRow('shape', 'corners', value => t(`shape_${value}`)),
          sizeRow(),
          switchRow('bold', 'bold'),
          switchRow('italic', 'italic')),
      ],
      text: group(null,
        selectRow('textCase', 'case', value => example({ textCase: value })),
        selectRow('brackets', 'brackets', value => example({ brackets: value })),
        selectRow('separator', 'separator', value => example({ separator: value })),
        selectRow('words', 'words', value => example({ words: value }))),
      where: [
        group(null,
          switchRow('chat', 'chat'),
          switchRow('about', 'about'),
          switchRow('own', 'own')),
        group(null,
          selectRow('place', 'place', value => t(`place_${value}`)),
          switchRow('link', 'link', 'linkSub')),
      ],
    };
    const tabLabel = { style: 'tabStyle', text: 'sectionText', where: 'sectionWhere' };

    // Tabs: a segmented control, with the arrow keys moving between them as usual.
    const buttons = TABS.map(name => h('button', { type: 'button', role: 'tab', id: `tab-${name}`, 'aria-controls': `panel-${name}`,
      'data-key': `tab:${name}`, text: t(tabLabel[name]), onclick: () => selectTab(name) }));
    const tablist = h('div', { class: 'tabs', role: 'tablist' }, buttons);
    tablist.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[event.key];
      if (!step) return;
      event.preventDefault();
      const rtl = document.documentElement.dir === 'rtl' && Math.abs(step) === 1 ? -1 : 1;
      const from = buttons.includes(document.activeElement) ? buttons.indexOf(document.activeElement) : TABS.indexOf(tab);
      const next = Math.min(TABS.length - 1, Math.max(0, from + step * rtl));
      selectTab(TABS[next]);
      buttons[next].focus();
    });
    const panelNodes = TABS.map(name => h('div', { class: 'panel', role: 'tabpanel', id: `panel-${name}`, 'aria-labelledby': `tab-${name}` }, panels[name]));
    function selectTab(name) {
      tab = name;
      Promise.resolve(ext.storage.local.set({ settingsTab: name })).catch(() => {});
      buttons.forEach((button, index) => {
        const on = TABS[index] === name;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
      });
      panelNodes.forEach((panel, index) => { panel.hidden = TABS[index] !== name; });
    }
    selectTab(tab);

    const main = h('div', { class: 'main' }, h('div', { class: 'panels' }, panelNodes), actions());
    syncers.push(() => main.querySelector('.panels').classList.toggle('is-off', !look.on));

    document.getElementById('app').replaceChildren(
      h('div', { class: 'side' },
        h('header', { class: 'bar' },
          h('img', { class: 'logo', src: 'icons/logo.svg', alt: '' }),
          h('h1', { text: t('appTitle') }),
          h('label', { class: 'master', title: t('show') }, switchInput('on', t('show')))),
        location.hash === '#installed' ? h('p', { class: 'installed', role: 'status', text: t('installed') }) : null,
        previewCard(),
        tablist),
      main);
  }

  document.documentElement.lang = (ext.i18n && ext.i18n.getUILanguage()) || 'en';
  document.documentElement.dir = t('@@bidi_dir') === 'rtl' ? 'rtl' : 'ltr';
  document.title = t('appTitle');

  Promise.resolve()
    .then(() => ext.storage.local.get(['look', 'previewTheme', 'settingsTab']))
    .catch(() => ({}))
    .then(stored => {
      look = LOOK.clean(stored && stored.look);
      if (stored && (stored.previewTheme === 'dark' || stored.previewTheme === 'light')) theme = stored.previewTheme;
      if (stored && TABS.includes(stored.settingsTab)) tab = stored.settingsTab;
      build();
      sync();
    });

  // A change made somewhere else (the popup and the options tab both open): follow it.
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.look) return;
    const incoming = LOOK.clean(changes.look.newValue);
    if (recentSaves.includes(JSON.stringify(incoming))) return;
    look = incoming;
    sync();
  });
})();
