# Pronoun Tags privacy policy

*Last updated: 8 October 2026*

Pronoun Tags for Twitch shows people's pronouns next to their names in Twitch chat. It has no servers of its own, no accounts, no analytics, no tracking and no ads. This page explains what it reads, what it sends, and what it keeps.

## What Pronoun Tags reads

It only runs on `www.twitch.tv` and `dashboard.twitch.tv`.

- **Usernames in chat,** and the name of the channel you're viewing, to know whose pronouns to show.
- **Your own Twitch login,** from Twitch's `login` cookie (or the login inside Twitch's `twilight-user` cookie), only so it can leave your own messages untagged if you turn that on. Nothing else in your cookies is used, and your login isn't saved or sent anywhere.

## What Pronoun Tags sends

To show pronouns, it sends usernames to the pronouns API at `api.pronouns.alejo.io`: the usernames of people whose messages appear in chat, and the name of the channel you're viewing (for the tag on its About panel). The API answers with the pronouns each person has chosen at [pr.alejo.io](https://pr.alejo.io).

- The requests don't include cookies or anything about you, but like any web request they reveal your IP address to that service.
- Each person is looked up at most about once an hour; answers are kept in memory, not saved.
- That service is run independently of Pronoun Tags; see [pr.alejo.io](https://pr.alejo.io) for how it handles requests.
- Turning off **Show pronouns** stops all lookups.

Pronoun Tags sends nothing else, to anyone. It never sells or shares data, and never uses it for anything but showing pronouns.

## What Pronoun Tags keeps

Your settings (how tags look and where they show) are kept in your browser's extension storage on your computer. Nothing about other people is saved.

## Removing your data

Uninstalling Pronoun Tags removes its settings. **Reset to defaults** in its settings puts them back to how they started.

## Contact

Questions or problems: [open an issue](../../issues) on this repository.

If this policy changes, the new version will be posted here with a new date.
