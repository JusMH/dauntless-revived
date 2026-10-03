# Hunt overflow

The main deploy server can route whole ISLAND hunt requests, including the party roster,
to a second deploy server. Accounts, progression, Ramsgate and Training stay on the main
server. Running hunts are not migrated; the next hunt is allocated to an available host.

Set `OVERFLOW_DEPLOYSERVER_URL` to an HTTP IPv4-loopback SSH tunnel and
`OVERFLOW_AFTER_HUNTS` to the number of local hunts/tutorials before spilling over
(default 4). Capacity refusal on either host permits trying the other. A timeout or
connection reset may mean a process already started, so it does not launch a duplicate.

On the worker set `HUNT_WORKER=1`, its public `MY_IP`, the central metagame server key,
and an exclusive game-port range. The last two configured ports are reserved and unused.
All worker hunt ports must be below 8776: the native idle-shutdown exception identifies
persistent worlds by port. Retain the memory guard and limit the worker's hunt slots to
its measured CPU/RAM budget. Install the same tested DLL, game files and runtime.

Keep both deploy APIs bound to loopback. A supervised SSH connection forwards the
worker deploy API and allowlist helper onto the main host, and reverse-forwards the
central metagame port onto worker loopback. Restrict the tunnel key to the main host.
Configure `ALLOWLIST_ADDITIONAL_URLS` in the main gateway with the worker helper's
loopback tunnel URL and share the helper secret securely. Each helper receives only
authenticated player addresses, with independent retry/cache state. Allow the worker's
game UDP range in the provider firewall; Windows Firewall remains address restricted.

The `/gameservers` view includes worker records with `host: "overflow"`; process IDs
belong to that worker and must not be sampled as local PIDs. If the tunnel or worker is
unavailable, its records are omitted and local routing remains available. Configure
service supervision on both hosts and check the reverse backend connection, game UDP
listeners, allowlist updates and an actual player join before calling the setup verified.
