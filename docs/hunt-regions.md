# World regions

Launcher Settings offers Main and Australia (OCE). The preference is saved to the authenticated account when Play is pressed; relaunch after changing it. Older launchers/accounts default to Main.

Australia routes Ramsgate and hunts to the AUS worker. Main retains its two-host Ramsgate/hunt pool. Training Grounds remains in Main. Cross-region invitations use the central party/account backend; an invited player's own preference does not override the party leader's hunt region. Private party rosters remain isolated, and public queues group the same hunt within the same region.

An explicit OCE selection never silently falls back to Main. If AUS is unavailable or full, the existing bounded capacity wait applies. Main retains its overflow behavior, including AUS when the Main pool is full. Ambiguous launch failures never duplicate a hunt.

## Configuration

- Main metagame: `AUS_REGION=1` enables the account preference API.
- Main deploy: `AUS_DEPLOYSERVER_URL=http://127.0.0.1:61021`; retain the Main worker's `OVERFLOW_DEPLOYSERVER_URL`.
- AUS deploy: `HUNT_WORKER=1`, `WORKER_RAMSGATE=1`, no regional or overflow URL. The central metagame is reached through the private tunnel.
- AUS Ramsgate uses `PORT_RANGE_END`; hunt ports end two ports below it. Include Ramsgate's UDP port in `ALLOWLIST_PORTS` and publish the updated configuration through the main gateway's additional allowlist tunnel.
- The main dashboard uses `DASHBOARD_WORKER_URL` and `DASHBOARD_AUS_URL` for its private worker monitors. Overview combines all hosts; Server #1, #2 and #3 retain their own resource/process/world views.
- The Discord status worker reads the owner-protected dashboard over `STATUS_DASHBOARD` (default loopback port 61110). Only numeric aggregate metrics and fixed public labels enter the embed; no addresses, account details or raw errors are forwarded.

`GET/POST /undaunted/api/HuntRegion` requires the player's account key. POST accepts only `{ "region": "main" }` or `{ "region": "aus" }`. Migration 0020 stores preferences in the shared database.

## Hunt cleanup

The watchdog checks every minute. `HUNT_MAX_AGE_MINUTES=120` stops temporary hunts/tutorials after two hours, including occupied instances. `HUNT_EMPTY_MINUTES=10` permits earlier retirement only after continuously fresh native zero-connection readings. Missing/stale readings reset the empty timer. Ramsgate and Training are exempt. Ports are released only after the original child exits.

## Operations and verification

Fleet CPU is an equal-host arithmetic mean; memory and hunts are summed. Stale hosts make combined totals unavailable. Monitoring and matchmaking assignments do not prove native player entry or hunt completion.

Rollback regional routing by setting `AUS_REGION=0` and removing the main deploy AUS URL; existing preference rows are retained. Move affected players to Main in launcher Settings. Preserve the shared account database and drain active worlds before stopping a worker.

## Launcher and firewall migration checks

Launcher 0.1.23 forwards `huntRegion` through the preload IPC bridge; earlier region-enabled versions could discard the selection and redraw Main. The preload regression executes the actual bridge and checks both region values survive a settings reload.

When moving a worker's game directory, inspect the application filter as well as UDP ports and remote addresses on `DauntlessRevived-GamePorts-Allowlist`. An existing program-specific rule can still point to the old executable even while the allowlist helper reports healthy. Set its program to the deployed `GAMESERVER_BINARY_PATH` (or preserve an intentionally unrestricted application filter); do not clear the authenticated remote-address restrictions. The helper updates ports/addresses but preserves existing application filters.

Verify actual native `connections` after the change. A successful CITY assignment, a bound UDP socket, and healthy backend/allowlist processes alone do not prove that players can reach a world.
