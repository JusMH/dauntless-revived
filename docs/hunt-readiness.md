# Hunt startup and worker operation

Deploy the matching `UndauntedInternalServer.dll` and deploy-server build together.
Set `GAMESERVER_READY_DIR` to a private writable directory on each game host. The
native server writes its PID and port only after `InitListen` succeeds; deployment
waits up to 90 seconds for that launch's marker before returning a travel address.
Without this setting, the upstream five-second process-survival check remains.
Never enable marker mode with an older DLL: all launches would time out.

Launches retain their configured spacing and memory reservations, but one cold
world no longer blocks every following launch. Client queue/status requests wait
at most 1.5 seconds for an allocation, then keep reporting matching until it ends.
Temporary worlds allow 180 seconds for the first player to finish connecting.
After a player connects, the empty-world timer resets and allows 60 seconds after
the last player leaves. Unavailable host capacity still has a bounded one-minute
queue; more time cannot create CPU, RAM or free ports.

The installation has two servers: the main host and one overflow worker connected
by an `OVERFLOW_DEPLOYSERVER_URL` loopback SSH tunnel. Existing hunts are not
live-migrated between hosts. Both use the main metagame's account and save database.

For native builds use MSVC 14.44 or newer. On machines with multiple v143 versions,
pass `/p:VCToolsVersion=14.44.35207` to MSBuild. The older 14.36 compiler rejects
the generated SDK's uninstantiated `static_assert(false)` templates.

## Store

The central metagame owns the store and inventory; workers use that same backend.
Set `STORE=free` to enable the shipped catalog. Offers currently cost zero. See
[`UndauntedMetagame/STORE_PRICING.md`](../UndauntedMetagame/STORE_PRICING.md) before
changing earned-currency prices. No real-money payment processing is provided.

Set `STORE_CATALOG_PROFILE=curated30` for the 30-cosmetic storefront listed in
`UndauntedMetagame/src/vendor/store_curated_30.json`. Set `STORE_REPEATABLE_TOKENS=0`;
the curated profile excludes bounty-token bundles even if that flag is enabled.
Other offers cannot be purchased by bypassing the listing and requesting their SKU.
The separate Hunt Pass endpoint remains available.

To revoke the earlier free-store purchases, stop both hosts' game processes and
the metagame, back up the database, then run `scripts/revoke-free-store.cjs <UTC-cutoff>`
from the metagame directory with its protected environment loaded. This previews
the recorded grants. Add `--apply` to revoke them. It preserves pre-owned and
separately earned items, removes only recorded store instance IDs/stack quantities,
and revokes entitlements only where their source is the matching store SKU.
Append-only audit markers prevent a second removal. Unredeemed pre-cutoff tokens
expire. Paid purchases abort the operation. The command checks that character
and escalation progress is unchanged; it is not an account rollback.
