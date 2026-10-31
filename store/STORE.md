# Pronoun Tags for Twitch: store listing

Everything the Chrome Web Store, Firefox Add-ons and Edge Add-ons forms ask for, ready to paste.

- **Package:** `./package.sh` → `dist/pronoun-tags-<version>.zip` (the same zip for all three stores)
- **Privacy policy URL:** `https://github.com/AmeliaFromFinance/Pronoun-Tags/blob/main/PRIVACY.md`
- **Website:** `https://pronouns.sinist3r.lol`
- **Support:** `https://github.com/AmeliaFromFinance/Pronoun-Tags/issues`
- **Images:** this folder (see the table at the end)

## Listing text

**Name:** Pronoun Tags for Twitch

**Summary** (from the manifest; Chrome allows 132 characters, Firefox 250):

> Shows pronouns from pr.alejo.io next to names in Twitch chat, in a style you choose.

**Description** (plain text; Edge needs at least 250 characters):

```
See people's pronouns next to their names in Twitch chat, and next to the streamer's name on About panels.

Pronouns come from pr.alejo.io, where anyone can set their own for free. People with none set get no tag. Click a tag to set yours.

MAKE IT YOURS
Click the toolbar button for a live preview, then:
- Start from six styles: Classic, Name color, Outline, Subtle, Solid and Blush.
- Capitals: She/Her, she/her, SHE/HER or She/her.
- Brackets, the separator, or just the first word.
- Text in Twitch purple, their name color, gray or any color. A soft tint, no background or any color behind it.
- Outline, corners, size, bold and italic.
- Before or after the name. In chat, on About panels and on your own messages, each on or off.

WORKS WHERE YOU CHAT
Twitch chat, FrankerFaceZ, popout chat, mod view, the creator dashboard and VOD replays. Changes show up instantly, with no reload.

English, Español, Français, Deutsch, Português, Русский and 日本語.

PRIVACY
No servers, no analytics, no ads. To look up pronouns, usernames from chat (and the channel you're viewing) are sent to api.pronouns.alejo.io. Settings stay in your browser.

Using FrankerFaceZ's own Pronouns add-on? Turn one of them off so you don't see pronouns twice.

Not made by or affiliated with Twitch or pr.alejo.io.
```

**Category:** pick the closest social or communication category in each store: for example Social Networking on Chrome, Social & Communication on Firefox, and Social on Edge. The lists change, so go by what each form offers.

**Search terms** (Edge, up to 7): `pronouns`, `twitch`, `chat`, `lgbtq`, `pronoun badges`, `frankerfacez`, `inclusive`

## Chrome Web Store and Edge: privacy practices

**Single purpose:**

> Shows the pronouns that Twitch chatters have set at pr.alejo.io next to their names in Twitch chat and on channel About panels.

**Permission justifications:**

| Asked about | Answer |
|---|---|
| `storage` | Keeps the user's settings for how pronoun tags look and where they appear. |
| Host permission `https://api.pronouns.alejo.io/*` | Looks up the pronouns each chatter has set at pr.alejo.io. Only usernames are sent. |
| Content scripts on `https://www.twitch.tv/*` and `https://dashboard.twitch.tv/*` | Finds usernames in Twitch chat and on the channel About panel, and adds the pronoun tag beside each one. |

**Remote code:** No, I am not using remote code.

**Data usage:** tick these, then all three certifications (not sold; not used or transferred for unrelated purposes; not used for creditworthiness or lending):

| Category | Why |
|---|---|
| Personally identifiable information | Reads the user's own Twitch login from Twitch's cookie, only to leave their own messages untagged when they choose that. Used in the page only. |
| Web history | The name of the Twitch channel being viewed is sent to the pronouns API, for the tag on its About panel. |
| Website content | Reads usernames from Twitch chat; those usernames are sent to the pronouns API to look up pronouns. |

## Firefox Add-ons

- **Listing:** "On this site" (public).
- **Compatibility:** Firefox. Tick Android only after trying it there.
- **Source code:** No. The code isn't minified or bundled. Upload the files exactly as they are in the repository; don't run `strip_comments.py` on this zip, because Mozilla counts removing comments as minifying and would then ask for the source.
- **Data collection:** already declared in `manifest.json`: required `websiteContent` and `browsingActivity`. Firefox shows this in the install prompt.
- **Privacy policy:** tick "This add-on has a privacy policy" and paste the text of `PRIVACY.md`.
- **License:** the one in your repository's LICENSE file.
- **Add-on URL:** `pronoun-tags-for-twitch`, if it's free.

## Notes for reviewers

```
Pronoun Tags shows the pronouns Twitch chatters have set at pr.alejo.io next to their names.

How to test: open any busy Twitch channel (no sign-in needed). Chatters who have set pronouns at pr.alejo.io get a tag after their name, and the channel's About panel heading gets one too if the streamer has set theirs. Click the toolbar button to change how tags look; open Twitch tabs update straight away.

background.js makes every request to api.pronouns.alejo.io (usernames only, no cookies), at most 6 at a time, cached for an hour. content.js finds names and adds the tags. The user's own login is read from Twitch's login cookie only to support "On your own messages: off"; it isn't stored or sent.

No remote code, no analytics, no other servers. The source is not minified.
```

## Images

| File | Size | Used by |
|---|---|---|
| `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png` | 1280×800 | Chrome (at least 1, up to 5), Edge (up to 6), Firefox |
| `promo-small.png` | 440×280 | Chrome (required), Edge (optional) |
| `logo-300.png` | 300×300 | Edge store logo |

Chrome's store icon is the 128×128 icon already in the zip.
