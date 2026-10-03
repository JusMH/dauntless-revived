# Discord key distribution

Run alongside the metagame with Node 22.12 or later. Copy `.env.example` to `.env`, set the Discord bot token and a metagame admin key, then run `npm ci` and `npm start`. Keep `.env` and the state directory private and outside Git. Back up the state with the game database; a corrupt state file stops issuance rather than starting over.

The bot registers `/key claim` and `/key status` without replacing its other commands. Invite the bot with the `bot` and `applications.commands` scopes. It needs no message-content intent. Commands work in the server and in bot DMs. Codes are sent only by DM; command acknowledgements are private.

`/key claim` generates one single-use **registration code** per Discord user on the server. The player enters it in the launcher's registration screen and chooses a username; the launcher receives the account's login key from the existing registration API. This is not recovery of an existing account's login key. `/key status` checks actual redemption in the metagame. A retry resends the same unused code, including after a DM failure. Redeemed or revoked codes are never replaced automatically.

The bot's admin key is sent only to loopback HTTP. Configure `KEY_STATE_FILE` outside the application directory on deployments so code updates do not erase claims. Run one instance, with filesystem permissions limited to its service account and administrators. Never paste a bot token into `.gitignore`; ignore the file containing it.
