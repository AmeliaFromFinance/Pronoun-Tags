/*
 * Pronoun Tags for Twitch: content script.
 *
 * Watches the page for chat usernames and the channel About panel, asks the background worker for each person's
 * pronouns and puts a small tag beside their name. How the tags look and where they go comes from the settings
 * (look.js reads them; content.css draws them), and changes there show up straight away without a reload.
 *
 * Works with Twitch's own chat, FrankerFaceZ's chat (which replaces Twitch's chat lines) and, best effort, 7TV's.
 */
(() => {
  'use strict';
  if (window.__pronounTagsLoaded) return;
  window.__pronounTagsLoaded = true;

  const ext = globalThis.browser ?? globalThis.chrome;
  const LOOK = PronounLook;

  const SETTINGS_URL   = 'https://pr.alejo.io';
  const ERROR_RETRY_MS = 60 * 1000;
  const CACHE_PRUNE_AT = 3000;
  const LOGIN_PATTERN  = /^[a-z0-9_]{1,25}$/;

  // Chat usernames. Twitch, FFZ, VOD replay and whispers all use .chat-author__display-name.
  const NAME_SELECTOR  = '.chat-author__display-name, .seventv-chat-user-username';
  // The tag goes beside the clickable name wrapper (so it also follows a localized name's "(login)"), never inside
  // it, or clicking the tag would open the user card.
  const NAME_WRAPPER   = '.chat-line__username, .seventv-chat-user';
  const MESSAGE_LINE   = '.chat-line__message, [data-a-target="chat-line-message"], .vod-message, .seventv-message';
  const ABOUT_HEADING  = '[data-a-target="about-panel"] h3';
  const OUR_TAG        = '.pn-tag[data-pn-for]';

  // First path segments that aren't channels (for the About heading).
  const RESERVED_PATHS = new Set(['videos', 'directory', 'settings', 'u', 'p', 'search', 'friends', 'subscriptions',
    'wallet', 'inventory', 'drops', 'popout', 'moderator', 'team', 'login', 'signup', 'embed', 'downloads', 'jobs',
    'turbo', 'prime', 'store', 'messages', 'payments', 'subs', 'following']);

  const message = (key, fallback) => { try { return ext.i18n.getMessage(key) || fallback; } catch (error) { return fallback; } };
  const TEXT = {
    title: message('tagTitle', 'Pronouns from pr.alejo.io. Click to set your own.'),
    titlePlain: message('tagTitlePlain', 'Pronouns from pr.alejo.io'),
    label: message('tagLabel', 'Pronouns: {pronouns}. Opens pr.alejo.io to set your own.'),
    labelPlain: message('tagLabelPlain', 'Pronouns: {pronouns}'),
  };

  let look = null;       // the settings; nothing happens until they've been read
  let stopped = false;

  /* ---- Settings ---- */

  const active = () => !!look && look.on && !stopped;

  function applyLook() {
    if (look && document.documentElement) LOOK.apply(document.documentElement, look);
  }

  function setLook(raw) {
    const before = look;
    look = LOOK.clean(raw);
    applyLook();
    if (!before) return start();
    if (!active()) { removeAllTags(); return; }
    // A different element (link or not) or the other side of the name: start the tags over.
    if (before.link !== look.link || before.place !== look.place) removeAllTags();
    if (!before.on || before.chat !== look.chat || before.about !== look.about) fullScanQueued = true;
    scheduleFlush();
    refreshAll();   // re-writes every tag for the new text settings, and adds or removes them for the "where" ones
  }

  Promise.resolve()
    .then(() => ext.storage.local.get('look'))
    .then(stored => setLook(stored && stored.look), () => setLook(null));

  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.look && !stopped) setLook(changes.look.newValue);
  });

  function removeAllTags() {
    document.querySelectorAll(OUR_TAG).forEach(tag => tag.remove());
  }

  // Who's signed in, to leave their own messages untagged when that's switched off. Only the login is read.
  let viewer;
  function viewerLogin() {
    if (viewer !== undefined) return viewer;
    const cookie = name => { const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); return match ? match[1] : null; };
    viewer = normalizeLogin(cookie('login'));
    if (!viewer) {
      try { const user = JSON.parse(decodeURIComponent(cookie('twilight-user') || 'null')); viewer = normalizeLogin(user && user.login); }
      catch (error) { viewer = null; }
    }
    return viewer;
  }

  /* ---- Lookups (answered by background.js, cached here until the expiry it gives) ---- */

  const cache = new Map();      // login -> { parts: string[]|null, expiresAt }
  const inFlight = new Set();
  const retryAt = new Map();    // login -> time a failed lookup may be retried

  const isFresh = entry => !!entry && entry.expiresAt > Date.now();

  function pruneCache() {
    if (cache.size < CACHE_PRUNE_AT) return;
    for (const [login, entry] of cache) if (!isFresh(entry)) cache.delete(login);
  }

  function requestPronouns(login) {
    if (!active() || isFresh(cache.get(login)) || inFlight.has(login) || (retryAt.get(login) || 0) > Date.now()) return;
    inFlight.add(login);
    let reply;
    try {
      reply = ext.runtime.sendMessage({ type: 'pronouns:lookup', login });
    } catch (error) {
      inFlight.delete(login);
      stopIfOrphaned(error);
      return;
    }
    Promise.resolve(reply)
      .then(result => {
        if (result && result.ok) {
          const parts = Array.isArray(result.parts) && result.parts.length ? result.parts.map(String) : null;
          cache.set(login, { parts, expiresAt: result.expiresAt });
          retryAt.delete(login);
          pruneCache();
        } else {
          scheduleRetry(login, (result && result.retryAt) || Date.now() + ERROR_RETRY_MS);
        }
      })
      .catch(error => { scheduleRetry(login, Date.now() + ERROR_RETRY_MS); stopIfOrphaned(error); })
      .finally(() => { inFlight.delete(login); renderLogin(login); });
  }

  // A failed lookup is retried later, as long as that person's name is still on the page.
  function scheduleRetry(login, when) {
    retryAt.set(login, when);
    setTimeout(() => { if (document.querySelector(`[data-pn-login="${login}"]`)) requestPronouns(login); }, Math.max(0, when - Date.now()) + 50);
  }

  // After the extension is updated or reloaded, this copy of the script loses its connection. Stop quietly instead
  // of throwing on every chat message.
  function stopIfOrphaned(error) {
    const text = String((error && error.message) || error);
    let connected = false;
    try { connected = !!(ext.runtime && ext.runtime.id); } catch (_) { /* Firefox: dead object */ }
    if (connected && !/context invalidated/i.test(text)) return;
    stopped = true;
    observer.disconnect();
  }

  /* ---- Whose name an element is ---- */

  function normalizeLogin(value) {
    const login = String(value || '').trim().replace(/^[(@]+|[)]+$/g, '').toLowerCase();
    return LOGIN_PATTERN.test(login) ? login : null;
  }

  function loginForName(nameEl) {
    const line = nameEl.closest(MESSAGE_LINE);
    const wrapper = nameEl.closest(NAME_WRAPPER) || nameEl.parentElement;
    const intlLogin = wrapper && wrapper.querySelector('.chat-author__intl-login');
    const candidates = [
      nameEl.getAttribute('data-a-user'),              // Twitch
      line && line.getAttribute('data-a-user'),         // Twitch, on the message line
      line && line.getAttribute('data-user'),           // FrankerFaceZ
      intlLogin && intlLogin.textContent,               // localized display name, e.g. "日本語 (login)"
      nameEl.textContent,                               // display names only differ from logins by case
    ];
    for (const candidate of candidates) {
      const login = normalizeLogin(candidate);
      if (login) return login;
    }
    return null;
  }

  function channelFromPath() {
    if (location.hostname !== 'www.twitch.tv') return null;
    const login = normalizeLogin(location.pathname.split('/').filter(Boolean)[0]);
    return login && !RESERVED_PATHS.has(login) ? login : null;
  }

  /* ---- Tags
   *   data-pn-login   whose pronouns go here
   *   data-pn-slot    "chat" (the tag goes beside the name) or "inside" (About heading: the tag is appended)
   *   data-pn-for     on a tag: whose pronouns it shows
   * ---- */

  function anchorFor(nameEl) {
    const wrapper = nameEl.closest(NAME_WRAPPER);
    if (wrapper) return wrapper;
    // Elsewhere, step out of any link or button around the name so the tag isn't nested in it.
    const line = nameEl.closest(MESSAGE_LINE);
    const interactive = nameEl.closest('a, button, [role="button"]');
    return interactive && interactive !== line && (!line || line.contains(interactive)) ? interactive : nameEl;
  }

  function existingTag(target) {
    if (target.dataset.pnSlot === 'inside') return target.querySelector(`:scope > ${OUR_TAG}`);
    const anchor = anchorFor(target);
    const beside = look.place === 'before' ? anchor.previousElementSibling : anchor.nextElementSibling;
    return beside && beside.matches(OUR_TAG) ? beside : null;
  }

  function createTag(heading) {
    const tag = document.createElement(look.link ? 'a' : 'span');
    tag.className = heading ? 'pn-tag pn-tag--heading' : 'pn-tag';
    tag.dataset.pnFor = '';
    if (look.link) {
      tag.href = SETTINGS_URL;
      tag.target = '_blank';
      tag.rel = 'noopener noreferrer';
    }
    // Clicks shouldn't reach Twitch's chat handlers (user card, reply and so on).
    tag.addEventListener('click', event => event.stopPropagation());
    return tag;
  }

  function wanted(target, login) {
    if (!active()) return false;
    if (target.dataset.pnSlot === 'inside') return look.about;
    return look.chat && (look.own || login !== viewerLogin());
  }

  function render(target) {
    const login = target.dataset.pnLogin;
    if (!login || !look) return;
    const entry = cache.get(login);
    let tag = existingTag(target);

    if (!wanted(target, login)) { if (tag) tag.remove(); return; }
    if (!isFresh(entry)) {
      // Waiting on a (re)lookup. Keep a tag that's already right for this person; drop one that belonged to someone
      // else (the About heading after switching channels).
      if (tag && tag.dataset.pnFor !== login) tag.remove();
      return;
    }
    if (!entry.parts) { if (tag) tag.remove(); return; }

    const inside = target.dataset.pnSlot === 'inside';
    if (!tag) {
      tag = createTag(inside);
      if (inside) target.append(tag);
      else if (look.place === 'before') anchorFor(target).before(tag);
      else anchorFor(target).after(tag);
    }
    tag.dataset.pnFor = login;
    if (!inside) {
      // For "their name color". Read every time: Twitch can change a name's color without replacing the line.
      const nameColor = getComputedStyle(target).color;
      if (nameColor && tag.style.getPropertyValue('--pn-name') !== nameColor) tag.style.setProperty('--pn-name', nameColor);
    }
    const label = LOOK.format(entry.parts, look);
    const title = look.link ? TEXT.title : TEXT.titlePlain;
    const spoken = (look.link ? TEXT.label : TEXT.labelPlain).replace('{pronouns}', label);
    if (tag.textContent !== label) tag.textContent = label;
    if (tag.title !== title) tag.title = title;
    if (tag.getAttribute('aria-label') !== spoken) tag.setAttribute('aria-label', spoken);
  }

  function renderLogin(login) {
    document.querySelectorAll(`[data-pn-login="${login}"]`).forEach(render);
  }

  function refreshAll() {
    document.querySelectorAll('[data-pn-login]').forEach(target => {
      render(target);
      if (wanted(target, target.dataset.pnLogin)) requestPronouns(target.dataset.pnLogin);
    });
  }

  function track(target, login, slot) {
    if (target.dataset.pnLogin !== login) target.dataset.pnLogin = login;
    if (target.dataset.pnSlot !== slot) target.dataset.pnSlot = slot;
    render(target);
    if (wanted(target, login)) requestPronouns(login);
  }

  /* ---- Finding names as Twitch adds them ---- */

  function processName(nameEl) {
    const login = loginForName(nameEl);
    if (login) track(nameEl, login, 'chat');
  }

  function scan(root) {
    if (root.nodeType !== Node.ELEMENT_NODE || root.classList.contains('pn-tag')) return;
    if (root.matches(NAME_SELECTOR)) processName(root);
    root.querySelectorAll(NAME_SELECTOR).forEach(processName);
  }

  function syncAboutPanel() {
    const heading = document.querySelector(ABOUT_HEADING);
    const login = heading && channelFromPath();
    if (login) track(heading, login, 'inside');
  }

  let pendingRoots = [];
  let fullScanQueued = false;
  let flushScheduled = false;

  function flush() {
    flushScheduled = false;
    if (!active()) { pendingRoots = []; return; }
    if (document.documentElement.dataset.pnColor !== look.color) applyLook();   // in case the page replaced <html>'s attributes
    const roots = pendingRoots;
    pendingRoots = [];
    if (fullScanQueued) { fullScanQueued = false; scan(document.body); }
    else for (const root of roots) if (root.isConnected) scan(root);
    syncAboutPanel();
  }

  function scheduleFlush() {
    if (flushScheduled || stopped) return;
    flushScheduled = true;
    // Before the next paint when visible, so cached tags appear with the message itself.
    if (document.hidden) setTimeout(flush, 250); else requestAnimationFrame(flush);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains('pn-tag')) continue;
        pendingRoots.push(node);
      }
      // A tag wiped out by Twitch re-rendering around it (the name stayed): look at that spot again.
      for (const node of mutation.removedNodes)
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('pn-tag')) pendingRoots.push(mutation.target);
    }
    if (pendingRoots.length > 2000) { pendingRoots = []; fullScanQueued = true; }
    // Always flush: the About heading can change through text-only updates (switching channels).
    scheduleFlush();
  });

  let started = false;
  function start() {
    if (started) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', start, { once: true }); return; }
    started = true;
    observer.observe(document.documentElement, { childList: true, subtree: true });
    fullScanQueued = true;
    scheduleFlush();
  }
})();
