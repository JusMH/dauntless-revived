# Owner dashboard

Run this separate Node.js 24 process **on the VPS**, from a checkout of the repository.
It listens only on `127.0.0.1:61110`. It does not change the database, game routes, firewall,
server configuration or running game processes. Stopping the dashboard stops only monitoring.

In PowerShell, use the actual path of the existing administrator account key:

```powershell
$env:DASHBOARD_OWNER_KEY_FILE = 'C:\DauntlessRevived\data\owner.key'
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
only the VPS owner should use this page. The dashboard is not automatically started by the kit.

## Readings

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
sample visible with a stale warning and timestamp. No live VPS test has been performed here.

## Logs

Set an explicit map of labels to existing log files before starting the process, for example:

```powershell
$env:DASHBOARD_LOG_FILES = @{ Metagame = 'C:\your-install\data\logs\metagame.out.log' } | ConvertTo-Json -Compress
```

Replace that example with the actual log path on your VPS. There is no directory browser or
arbitrary path endpoint. Select a log and press **Refresh log**; logs refresh on demand.
Each read is capped at 32 KB and the last 150 lines, each at most 2,000 characters. Only one log
read runs at once. Credential-bearing lines are omitted, but this is not a guarantee that arbitrary
third-party logs contain no secrets. Configure operational logs only, never `.env`, key files,
database files or raw wire/body captures. Logs may contain player information and stay owner-only.

Settings are listed in `tools/dashboard.env.example`. `DASHBOARD_PORT` may be changed (1024–65535).
The dashboard limits requests to 300 per minute across browsers. Multiple browser tabs share
backend polling, but many tabs can reach that limit.

Tests: `node --test tools/dashboard.test.mjs`. The tests use a fake read-only backend; they cover
authentication, foreign origins, log path rejection, redaction and external-backend rejection.
