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

The current overflow router uses one `OVERFLOW_DEPLOYSERVER_URL` loopback SSH
tunnel. A third worker requires extending routing, monitoring and gateway UDP
allowlist targets; do not point player traffic at an unconfigured host. Existing
hunts are not live-migrated between hosts.

For native builds use MSVC 14.44 or newer. On machines with multiple v143 versions,
pass `/p:VCToolsVersion=14.44.35207` to MSBuild. The older 14.36 compiler rejects
the generated SDK's uninstantiated `static_assert(false)` templates.

## Store

The central metagame owns the store and inventory; workers use that same backend.
Set `STORE=free` to enable the shipped catalog. Offers currently cost zero. See
[`UndauntedMetagame/STORE_PRICING.md`](../UndauntedMetagame/STORE_PRICING.md) before
changing earned-currency prices. No real-money payment processing is provided.
