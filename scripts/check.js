// Checks the extension without a browser. Run by scripts/test.sh.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');

process.chdir(path.resolve(__dirname, '..'));
const problems = [];
let passed = 0;
const check = (ok, message) => { if (ok) passed++; else problems.push(message); };
const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter(file => exists(file));

// Syntax
for (const file of tracked.filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); passed++; }
  catch (error) { problems.push(`${file}: ${String(error.stderr).split('\n').find(line => /Error/.test(line)) || 'syntax error'}`); }
}
const json = {};
for (const file of tracked.filter(f => f.endsWith('.json'))) {
  try { json[file] = JSON.parse(read(file)); passed++; } catch (error) { problems.push(`${file}: ${error.message}`); }
}

// Manifest: every file it names exists, and its text keys are in the default language
const manifest = json['manifest.json'];
if (manifest) {
  const named = [
    ...Object.values(manifest.icons || {}),
    ...Object.values((manifest.action && manifest.action.default_icon) || {}),
    manifest.action && manifest.action.default_popup,
    manifest.options_ui && manifest.options_ui.page,
    manifest.background && manifest.background.service_worker,
    ...((manifest.background && manifest.background.scripts) || []),
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
  ].filter(Boolean);
  for (const file of new Set(named)) check(exists(file), `manifest.json names ${file}, which doesn't exist`);
  check(/^\d+\.\d+\.\d+$/.test(manifest.version), `manifest.json version "${manifest.version}" isn't like 1.2.3`);
  const id = manifest.browser_specific_settings && manifest.browser_specific_settings.gecko && manifest.browser_specific_settings.gecko.id;
  check(/^[\w.-]+@[\w.-]+$/.test(id || ''), 'manifest.json is missing a Firefox add-on ID');
}

// Store text and welcome page: every language has every key the default one has
const localeDir = '_locales', base = manifest && manifest.default_locale;
const messages = lang => json[`${localeDir}/${lang}/messages.json`] || {};
if (base) {
  const english = messages(base);
  for (const key of JSON.stringify(manifest).match(/__MSG_(\w+)__/g) || []) check(key.slice(6, -2) in english, `manifest.json uses ${key}, which isn't in ${base}`);
  for (const lang of fs.readdirSync(localeDir)) {
    const keys = messages(lang);
    const missing = Object.keys(english).filter(key => !(key in keys));
    const extra = Object.keys(keys).filter(key => !(key in english));
    check(!missing.length, `${lang} is missing: ${missing.join(', ')}`);
    check(!extra.length, `${lang} has keys ${base} doesn't: ${extra.join(', ')}`);
  }
  for (const file of tracked.filter(f => f.endsWith('.html'))) {
    for (const [, key] of read(file).matchAll(/data-msg="(\w+)"/g)) check(key in english, `${file} uses ${key}, which isn't in ${base}`);
  }
}

// Rainbark: panel text and version
if (exists('languages.js') && exists('page.js')) {
  const sandbox = { window: {} };
  vm.runInNewContext(read('languages.js'), sandbox);
  const { TEXT_GROUPS, LANGUAGES } = sandbox.window.__rainbarkParts.text;
  const english = Object.assign({}, ...TEXT_GROUPS.map(group => group.strings));
  const page = read('page.js');
  for (const [, key] of page.matchAll(/\bt\('([\w.]+)'/g)) check(key in english, `page.js uses '${key}', which isn't in languages.js`);
  for (const [code, language] of Object.entries(LANGUAGES))
    for (const key of Object.keys(language.strings)) check(key in english, `languages.js: ${code} has '${key}', which English doesn't`);
  for (const [, id] of page.slice(page.indexOf('PALETTE_GROUPS'), page.indexOf('const PALETTES')).matchAll(/^\s+(\w+):\s/gm))
    if (id !== 'palettes') check(`palette.${id}` in english, `palette ${id} has no name in languages.js`);
  const pageVersion = (page.match(/const VERSION = '([^']+)'/) || [])[1];
  check(pageVersion === manifest.version, `page.js VERSION ${pageVersion} doesn't match manifest.json ${manifest.version}`);
}

// Pronoun Tags: settings text and styles
if (exists('look.js') && exists('settings.js')) {
  const sandbox = { globalThis: {} };
  vm.runInNewContext(read('look.js') + '\nglobalThis.PronounLook = PronounLook;', sandbox);
  const look = sandbox.globalThis.PronounLook;
  const english = messages(base);
  for (const [, key] of read('settings.js').matchAll(/\bt\('(\w+)'/g)) check(key in english, `settings.js uses '${key}', which isn't in ${base}`);
  for (const name of Object.keys(look.PRESETS)) check(`preset_${name}` in english, `style ${name} has no preset_${name} text`);
  const named = { color: 'color_', background: 'bg_', shape: 'shape_', place: 'place_' };
  for (const [key, prefix] of Object.entries(named))
    for (const value of look.CHOICES[key]) check(`${prefix}${value}` in english, `choice ${key}: ${value} has no ${prefix}${value} text`);
  check(look.format(['She', 'Her'], look.DEFAULTS) === 'She/Her', 'look.js formats She/Her wrongly with the defaults');
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log(`✓ ${passed} checks passed`);
