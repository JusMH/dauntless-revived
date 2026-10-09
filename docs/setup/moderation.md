# Account and IP bans

Launcher 0.1.29 shows the server's ban reason and **Go to support**, which opens
https://discord.gg/dauntlessrevived. Manual region choices remain manual; fresh
settings select Automatic and compare two TCP handshakes per available region.
TCP latency is an estimate, not in-game ping or a guarantee of available capacity.

The owner's dashboard, **Players & accounts → Player moderation**, accepts an
account ID from the directory. View status to see authenticated IP observations.
Enter a required reason, then Ban player. Leave the optional IP empty for an
account-only ban. An IP ban must use an address observed for that account and can
affect other users behind the same router/VPN. Unban requires a reason too.
Administrator accounts are protected from this interface.

The backend records distinct authenticated addresses and their last-seen time.
Only the trusted gateway's secret-authenticated forwarding header is accepted;
loopback addresses and arbitrary forwarded headers are not recorded. No hardware
IDs are collected. These records and ban history remain in the private database
until the operator removes them under their retention policy. Do not publish DB
backups or expose the owner dashboard publicly.

`GET /undaunted/api/Moderation/:accountId` and `POST /undaunted/api/Moderation`
require a direct owner/admin key, never a proxied request. POST accepts
`{accountId, reason, active, address?}`. Account and optional IP bans persist across
restarts. Backend authentication/token validation refuses banned accounts, and
IP bans block public API calls except server discovery. Existing native game
connections are not forcibly disconnected by this feature; enforcement occurs
on the next checked backend request or login. Shared backend enforcement applies
to every region. Unbanning re-enables existing account keys; no key rotation occurs.

Back up the database before applying migration `0023_moderation`. Rollback should
restore application code while retaining the additive tables, not overwrite
subsequent player saves with an old database. Older launchers will show a generic
key/login error instead of the reason; update them to 0.1.29.

Pooled Ramsgate needs the matching native DLL and deploy service together. Verify
`GAMESERVER_READY_DIR` and fresh `city-occupancy-PID.txt` snapshots on every worker.
Set `REGION_AUS_PROBE_HOST/PORT` and `REGION_GER_PROBE_HOST/PORT` to reachable TCP
listeners on those hosts. Probes send no credentials or application data.
