/*
 * Pronoun Tags for Twitch: background worker.
 *
 * All requests to the pronouns API happen here rather than in the Twitch tab. That keeps them
 * clear of Twitch's own page security rules, lets every Twitch tab share one cache, and means
 * a busy chat never fires more than a handful of requests at once.
 *
 * Runs as a service worker in Chromium and as an event page in Firefox; the same file works for both.
 */
'use strict';

const ext = globalThis.browser ?? globalThis.chrome;

const API_BASE = 'https://api.pronouns.alejo.io/v1';

// Pronouns are never shown from data more than an hour old. If the API's CDN says its copy is
// already some minutes old (the Age header), that time counts against the hour too.
const MAX_AGE_MS       = 60 * 60 * 1000;
const MIN_FRESH_MS     = 60 * 1000;          // floor, so a very old CDN copy isn't refetched every message
const ERROR_RETRY_MS   = 60 * 1000;          // after a failed request, wait this long before trying that user again
const RATE_LIMIT_MS    = 30 * 1000;          // pause after a 429 if the API doesn't say how long
const MAX_CONCURRENT   = 6;
const PRUNE_THRESHOLD  = 5000;

const LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/;

/* ---------------------------------------------------------------------------------------------
 * Request queue: at most MAX_CONCURRENT requests in flight, paused entirely after a 429.
 * ------------------------------------------------------------------------------------------- */

const queue = [];
let activeRequests = 0;
let pausedUntil = 0;
let resumeTimer = null;

function enqueue(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    pumpQueue();
  });
}

function pumpQueue() {
  const waitMs = pausedUntil - Date.now();
  if (waitMs > 0) {
    if (!resumeTimer) resumeTimer = setTimeout(() => { resumeTimer = null; pumpQueue(); }, waitMs);
    return;
  }
  while (activeRequests < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    activeRequests++;
    job.task().then(job.resolve, job.reject).finally(() => { activeRequests--; pumpQueue(); });
  }
}

function retryAfterMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RATE_LIMIT_MS;
}

// `cache: 'no-cache'` makes the browser check with the API instead of reusing its own HTTP cache,
// which would otherwise add up to another hour on top of ours (the API sends max-age=3600).
async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-cache', credentials: 'omit' });
  if (response.status === 429) {
    pausedUntil = Date.now() + retryAfterMs(response);
    throw new Error('rate limited');
  }
  return response;
}

function freshForMs(response) {
  const ageSeconds = Number(response.headers.get('age'));
  const ageMs = Number.isFinite(ageSeconds) && ageSeconds > 0 ? ageSeconds * 1000 : 0;
  return Math.max(MIN_FRESH_MS, MAX_AGE_MS - ageMs);
}

/* ---------------------------------------------------------------------------------------------
 * Pronoun definitions (sheher -> She/Her and so on). Rarely change; refreshed hourly.
 * ------------------------------------------------------------------------------------------- */

let definitions = null;          // { byId, loadedAt, expiresAt }
let definitionsRequest = null;

async function getDefinitions() {
  if (definitions && definitions.expiresAt > Date.now()) return definitions.byId;
  if (!definitionsRequest) {
    definitionsRequest = enqueue(async () => {
      const response = await apiGet('/pronouns');
      if (!response.ok) throw new Error(`pronoun list: HTTP ${response.status}`);
      const body = await response.json();
      const byId = {};
      for (const [id, entry] of Object.entries(body || {})) {
        if (entry && typeof entry.subject === 'string' && typeof entry.object === 'string')
          byId[id] = { subject: entry.subject, object: entry.object, singular: entry.singular === true };
      }
      definitions = { byId, loadedAt: Date.now(), expiresAt: Date.now() + MAX_AGE_MS };
      return byId;
    }).finally(() => { definitionsRequest = null; });
  }
  try {
    return await definitionsRequest;
  } catch (error) {
    if (definitions) return definitions.byId; // a stale list is fine; ids almost never change meaning
    throw error;
  }
}

/* ---------------------------------------------------------------------------------------------
 * Per-user records. `null` pronoun means the user has none set (the API's 404 not_found).
 * ------------------------------------------------------------------------------------------- */

const users = new Map();         // login -> { pronounId, altId, expiresAt }
const userRequests = new Map();  // login -> Promise of the record

function pruneUsers() {
  if (users.size < PRUNE_THRESHOLD) return;
  const now = Date.now();
  for (const [login, record] of users) if (record.expiresAt <= now) users.delete(login);
}

function fetchUser(login) {
  if (userRequests.has(login)) return userRequests.get(login);
  const request = enqueue(async () => {
    const response = await apiGet(`/users/${encodeURIComponent(login)}`);
    const expiresAt = Date.now() + freshForMs(response);
    if (response.status === 404) return { pronounId: null, altId: null, expiresAt };
    if (!response.ok) throw new Error(`${login}: HTTP ${response.status}`);
    const body = await response.json();
    return {
      pronounId: typeof body.pronoun_id === 'string' ? body.pronoun_id : null,
      altId: typeof body.alt_pronoun_id === 'string' ? body.alt_pronoun_id : null,
      expiresAt,
    };
  }).then(record => {
    users.set(login, record);
    pruneUsers();
    return record;
  }).finally(() => { userRequests.delete(login); });
  userRequests.set(login, request);
  return request;
}

/*
 * The words of a pronoun set, which the tab formats with the person's chosen look:
 *   main + alternate   -> both subjects        ['She', 'They']
 *   singular set       -> subject only         ['Any']
 *   everything else    -> subject and object   ['She', 'Her']
 */
function pronounParts(record, byId) {
  const main = record.pronounId && byId[record.pronounId];
  if (!main) return null;
  const alt = record.altId && record.altId !== record.pronounId ? byId[record.altId] : null;
  if (alt) return [main.subject, alt.subject];
  return main.singular ? [main.subject] : [main.subject, main.object];
}

async function lookup(rawLogin) {
  const login = String(rawLogin || '').toLowerCase();
  if (!LOGIN_PATTERN.test(login)) return { ok: true, parts: null, expiresAt: Date.now() + MAX_AGE_MS };

  let record = users.get(login);
  if (!record || record.expiresAt <= Date.now()) record = await fetchUser(login);
  if (!record.pronounId) return { ok: true, parts: null, expiresAt: record.expiresAt };

  let byId = await getDefinitions();
  if (!byId[record.pronounId] && definitions && Date.now() - definitions.loadedAt > ERROR_RETRY_MS) {
    // An id we haven't seen: the list may have grown since we loaded it, so reload it once.
    definitions.expiresAt = 0;
    byId = await getDefinitions();
  }
  // Still unknown means no tag for now (pronounParts returns null); it's looked at again when the record expires.
  return { ok: true, parts: pronounParts(record, byId), expiresAt: record.expiresAt };
}

/* ---------------------------------------------------------------------------------------------
 * Messages from the Twitch tabs, and the settings page once after installing.
 * ------------------------------------------------------------------------------------------- */

ext.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') ext.tabs.create({ url: ext.runtime.getURL('options.html#installed') });
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'pronouns:lookup') return false;
  lookup(message.login).then(
    result => sendResponse(result),
    error => {
      console.warn('[Pronoun Tags]', String(error && error.message || error));
      sendResponse({ ok: false, retryAt: Math.max(Date.now() + ERROR_RETRY_MS, pausedUntil) });
    });
  return true; // keep the channel open for the async response
});
