# Owner dashboard

Run this separate Node.js 24 process **on the VPS**, from a checkout of the repository.
It listens only on `127.0.0.1:61110`. Monitoring does not change the database, game routes, firewall,
server configuration or running game processes. The optional owner-only invite button creates
registration codes through the existing backend API. Stopping the dashboard does not stop the game.

In PowerShell, use the actual path of the existing administrator account key:

```powershell
$env:DASHBOARD_OWNER_KEY_FILE = 'C:\DauntlessRevived\data\keys\owner.key'
$env:DASHBOARD_BACKEND = 'http://127.0.0.1:61000'
node tools/dashboard.mjs
```

Open `http://127.0.0.1:61110` in a browser on the VPS. Enter the same owner account key.
The browser holds it in memory only; locking or reloading the page clears it.
To connect from your PC, leave the process running on the VPS and run:

```powershell
ssh -N -L 61110:127.0.0.1:61110 YOUR_SSH_USER@YOUR_VPS
```

Then open `http://127.0.0.1:61110` on your PC. No public dashboard firewall rule is needed.
Do not publish it through the public game gateway. The owner key grants administration rights;
only trusted server operators should use this page.

## Windows kit autostart

After updating the server code, run elevated on the VPS:

```powershell
C:\DauntlessRevived\bin\Install-OwnerDashboard.ps1 -OpenOnLogon
```

This installs a separate **LocalService** scheduled task at boot, gives it read access to the
owner key, server configuration and operational logs, and enables `BACKEND_HEALTH=1` for the next
metagame restart. It does not restart games or change the firewall. `Stack.ps1 start` / full
`restart` also starts the installed dashboard. A dashboard failure does not stop the stack.
With `-OpenOnLogon`, the installing operator gets the locked page when logging in via RDP and
on stack start/restart while their desktop session exists. Headless services cannot open a
browser on your PC; use an SSH tunnel there. The dashboard remains available when the game stack
is stopped so the owner can diagnose downtime. To disable it, disable its scheduled task and set
`DashboardEnabled=false` in the private `server.json`; disable the separate open-dashboard task
and set `DashboardOpenOnStart=false` to stop automatic browser opening.
Re-run the installer after server updates to refresh its four static/runtime files.

## Accounts and layout

Overview, Backend health, Players & accounts, Invites and Logs are separate lightweight views
(plain JavaScript, CSS and canvas; no chart framework or background log streaming).
The owner-only account directory loads on demand, 100 accounts per page. It shows launcher names,
UIDs, administrator roles and the first 16 hex characters of each active key's SHA-256 hash.
The database stores hashes, so original keys cannot be recovered. The optional **Calculate
fingerprint** input hashes a key in the browser without sending it; compare the result with the
directory. This is an identifier, not authentication, and filtering applies only to the current page.
Never share an owner key with a player. Page content uses text nodes, not player-supplied HTML.

## Player invites

Set `DASHBOARD_SERVER_CONFIG=C:\DauntlessRevived\data\config\server.json` before starting the
dashboard to enable public-mode invites. After unlocking, enter an optional label and 1–100 uses,
then press **Generate invite** and **Copy link**. The address, port and certificate fingerprint
come from this operator-controlled configuration, not browser input. Share the join link, never
the dashboard owner key. Invite creation does not grant administrator access.

`POST /api/invites` requires the owner key and an exact same-origin header, accepts at most 2 KB,
and allows at most ten submissions per minute with one in flight. It forwards only name and uses
to the loopback backend's authenticated `CreateInvite` route. Requests are never automatically
retried: if a response times out, an invite may already exist. Monitoring remains read-only.

## Readings

For backend metrics set `BACKEND_HEALTH=1` in the metagame's private `.env`, then restart the
metagame during a maintenance window. The default is off. The dashboard keeps working with
an older backend or disabled health route, labeling those readings unavailable.
The owner-only `GET /undaunted/api/BackendHealth` supplies backend uptime, RSS/heap memory,
completed responses per second, 4xx/5xx counts, aborted responses and latency percentiles.
Request figures cover the last 60 one-second buckets; percentile values are approximate histogram
upper bounds, with `>5000` for the overflow bucket. Monitoring polls are excluded. Event-loop
delay is sampled at 20 ms resolution, with percentiles since monitoring started (not a rolling minute).
No URL, body, token or player identifier is retained by this instrumentation. Database query timing
is not yet instrumented. VPS, backend and dashboard uptimes are shown separately.
Player counts split Ramsgate, hunts, Dojo, tutorial, menu and unknown locations. Bans display
**not implemented** because there is no backend ban model or enforcement; no ban actions are added.

CPU and used/total physical RAM describe the machine running the dashboard. Samples arrive every
five seconds. The process holds at most 720 samples (one hour), shared by every open browser.
It skips overlapping backend polls, uses three-second request timeouts and does not retry rapidly.
Player/world information comes from the existing five-second cached `ServerStatus` endpoint;
online players may remain visible for 90 seconds after disconnecting.

Account totals include administrators. The existing schema has no registration timestamp, so
"newly observed" counts additions seen after the first successful account-list poll. It resets
when the dashboard restarts and cannot reconstruct historical registrations or changes between
polls. Graph history also resets. Backend milliseconds measure local HTTP status/account requests,
including processing time, **not a player's game ping**. Backend failures leave the last successful
sample visible with a stale warning and timestamp.

Set `DASHBOARD_PERFORMANCE_DIR` to the kit's `data\logs\performance` directory for per-process
CPU, working set, private memory, PID, UDP port and uptime, plus disk free and network rates.
This reuses the existing minute sampler, checking bounded 128 KB file tails at most every 15 seconds;
it does not spawn PowerShell or scan processes every dashboard refresh. Yesterday's file is a
fallback at UTC midnight. Readings older than 150 seconds are visibly stale. CPU is normalized
to **the whole host**, unlike the source CSV's percentage of one core. On a two-vCPU host one full
core is 50%. Missing fields remain unknown, not zero. Actual game tick rate and frame time are
**not instrumented**; collecting authenticated game-engine telemetry is follow-up work.

Backend resident memory and heap graphs help identify sustained growth. Idle game worlds still
tick, and CPU use alone does not establish a leak. Compare private memory over long sessions and
after players leave. Inactive player tracking now expires after a ten-minute reconnection grace
period, swept at most once a minute on tracking updates/reads; live hunt locations remain intact.

## Logs

Set an explicit map of labels to existing log files before starting the process, for example:

```powershell
$env:DASHBOARD_LOG_FILES = @{ Metagame = 'C:\your-install\data\logs\metagame.out.log' } | ConvertTo-Json -Compress
```

Replace that example with the actual log path on your VPS. There is no directory browser or
arbitrary path endpoint. Select a log and press **Refresh log**; logs refresh on demand.
The Windows dashboard installer writes the same map to `dashboard/dashboard-logs.json` and
sets `DASHBOARD_LOG_CONFIG_FILE` to that path, avoiding JSON escaping inside an environment file.
Each read is capped at 32 KB and the last 150 lines, each at most 2,000 characters. Only one log
read runs at once. Credential-bearing lines are omitted, but this is not a guarantee that arbitrary
third-party logs contain no secrets. Configure operational logs only, never `.env`, key files,
database files or raw wire/body captures. Logs may contain player information and stay owner-only.

Settings are listed in `tools/dashboard.env.example`. `DASHBOARD_PORT` may be changed (1024–65535).
The dashboard limits requests to 300 per minute across browsers. Multiple browser tabs share
backend polling, but many tabs can reach that limit.

Tests: `node --test tools/dashboard.test.mjs`. The tests use a fake read-only backend; they cover
authentication, foreign origins, log path rejection, redaction and external-backend rejection.
