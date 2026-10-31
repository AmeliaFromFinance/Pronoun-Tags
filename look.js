/*
 * Pronoun Tags for Twitch: how tags look.
 *
 * Shared by the content script (tags on Twitch) and the settings page (its preview and presets), so the preview
 * always matches the real thing. Text is formatted here; everything visual is done by content.css, steered by
 * data-pn-* attributes and a few CSS variables that apply() puts on a container (<html> on Twitch).
 */
var PronounLook = globalThis.PronounLook || (() => {
  'use strict';

  const DEFAULTS = {
    // Where
    on: true, chat: true, about: true, own: true,
    place: 'after',             // after · before the name (chat only)
    link: true,                 // clicking a tag opens pr.alejo.io
    // Text
    textCase: 'title',          // title She/Her · lower she/her · upper SHE/HER · first She/her
    brackets: 'none',           // none · round (She/Her) · square [She/Her] · curly {She/Her}
    separator: 'slash',         // slash She/Her · spaced She / Her · dot She · Her · comma She, Her
    words: 'both',              // both She/Her · first She
    // Colors
    color: 'purple',            // purple (Twitch's accent) · name (the chatter's name color) · gray · custom
    customColor: '#BF94FF',
    background: 'tint',         // tint (a soft wash of the text color) · none · custom
    customBackground: '#9147FF',
    border: true,
    // Shape and size
    shape: 'pill',              // pill · rounded · square
    size: 85,                   // percent of the chat text
    bold: true, italic: false,
  };

  const CHOICES = {
    place: ['after', 'before'],
    textCase: ['title', 'lower', 'upper', 'first'],
    brackets: ['none', 'round', 'square', 'curly'],
    separator: ['slash', 'spaced', 'dot', 'comma'],
    words: ['both', 'first'],
    color: ['purple', 'name', 'gray', 'custom'],
    background: ['tint', 'none', 'custom'],
    shape: ['pill', 'rounded', 'square'],
  };
  const SWITCHES = ['on', 'chat', 'about', 'own', 'link', 'border', 'bold', 'italic'];
  const COLORS = ['customColor', 'customBackground'];
  const SIZE = { min: 60, max: 130, step: 5 };
  const HEX = /^#[0-9a-f]{6}$/i;

  // Ready-made styles. Each sets every look setting, but none of the "where" ones.
  const STYLE_KEYS = ['textCase', 'brackets', 'separator', 'words', 'color', 'customColor', 'background', 'customBackground',
    'border', 'shape', 'size', 'bold', 'italic'];
  const base = Object.fromEntries(STYLE_KEYS.map(key => [key, DEFAULTS[key]]));
  const PRESETS = {
    classic: { ...base },
    name:    { ...base, color: 'name' },
    outline: { ...base, color: 'name', background: 'none', shape: 'rounded' },
    subtle:  { ...base, textCase: 'lower', brackets: 'round', color: 'gray', background: 'none', border: false, bold: false },
    solid:   { ...base, textCase: 'upper', color: 'custom', customColor: '#FFFFFF', background: 'custom', customBackground: '#9147FF',
               border: false, shape: 'rounded', size: 75 },
  };

  function clean(raw) {
    const look = { ...DEFAULTS };
    if (!raw || typeof raw !== 'object') return look;
    for (const key of SWITCHES) if (typeof raw[key] === 'boolean') look[key] = raw[key];
    for (const key in CHOICES) if (CHOICES[key].includes(raw[key])) look[key] = raw[key];
    for (const key of COLORS) if (HEX.test(raw[key])) look[key] = raw[key].toUpperCase();
    const size = Math.round(Number(raw.size) / SIZE.step) * SIZE.step;
    if (Number.isFinite(size)) look.size = Math.min(SIZE.max, Math.max(SIZE.min, size));
    return look;
  }

  const presetMatches = (look, name) => STYLE_KEYS.every(key => look[key] === PRESETS[name][key]);

  /* ---- Text ---- */

  const CASES = {
    title: text => text.replace(/\p{L}[\p{L}\p{M}'’-]*/gu, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
    lower: text => text.toLowerCase(),
    upper: text => text.toUpperCase(),
    first: text => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  };
  const SEPARATORS = { slash: '/', spaced: ' / ', dot: ' · ', comma: ', ' };
  const BRACKETS = { none: ['', ''], round: ['(', ')'], square: ['[', ']'], curly: ['{', '}'] };

  // ['She', 'Her'] -> "She/Her", "(she/her)", "SHE" and so on.
  function format(parts, look) {
    const words = look.words === 'first' ? parts.slice(0, 1) : parts;
    const [open, close] = BRACKETS[look.brackets] || BRACKETS.none;
    return open + (CASES[look.textCase] || CASES.title)(words.join(SEPARATORS[look.separator] || '/')) + close;
  }

  /* ---- Appearance: content.css reads these ---- */

  function apply(element, look) {
    const data = {
      pnColor: look.color, pnBg: look.background, pnOutline: look.border ? 'on' : 'off', pnShape: look.shape,
      pnBold: look.bold ? 'on' : 'off', pnItalic: look.italic ? 'on' : 'off', pnPlace: look.place,
    };
    for (const key in data) if (element.dataset[key] !== data[key]) element.dataset[key] = data[key];
    element.style.setProperty('--pn-custom-fg', look.customColor);
    element.style.setProperty('--pn-custom-bg', look.customBackground);
    element.style.setProperty('--pn-scale', String(look.size / 100));
  }

  return { DEFAULTS, CHOICES, SIZE, PRESETS, STYLE_KEYS, clean, format, apply, presetMatches };
})();
