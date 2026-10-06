# Hunt regions

The launcher Settings page offers **Main** and **Australia (OCE)**. The choice is
saved to the authenticated account when Play is pressed. Existing launchers and
accounts default to Main. Restart the game after changing the launcher setting.

Ramsgate and the training dojo stay in the existing shared pool. Public hunt
queues group the same hunt within the same selected region. Private hunts keep
their existing roster isolation. A party always travels together; a party with
mixed preferences selects the pool with lower `(running + pending) / limit`.
Main capacity includes both its primary host and its overflow worker.

The Main pool keeps its existing overflow routing. If the preferred pool gives
an explicit capacity refusal, the other pool may receive the complete hunt.
An ambiguous launch timeout never causes a second launch in another region.
Consequently overflow can increase latency; a region is a preference, not a
guarantee that a full pool will retain the hunt.

## Configuration

- Main metagame: `AUS_REGION=1` enables selection through the account API.
- Main deploy: `AUS_DEPLOYSERVER_URL=http://127.0.0.1:61021` points to a private
  SSH tunnel. Keep the existing `OVERFLOW_DEPLOYSERVER_URL` for the Main worker.
- AUS: `HUNT_WORKER=1`, `WORKER_RAMSGATE=0`, with no regional or overflow URL.
  Its metagame loopback port must tunnel to the central metagame.
- Feed the AUS allowlist through an additional loopback URL in the main
  gateway's `ALLOWLIST_ADDITIONAL_URLS`. All helpers use the same protected secret.
- Allocate distinct hunt UDP ranges across the fleet. Update each worker's
  `PORT_RANGE_BEGIN`, `PORT_RANGE_END`, hunt limit and `ALLOWLIST_PORTS` together.

`GET /undaunted/api/HuntRegion` and `POST /undaunted/api/HuntRegion` require the
account key. POST accepts only `{ "region": "main" }` or `{ "region": "aus" }`;
it cannot target another account. Migration 0020 adds only the preference table.

Rollback: remove the main deploy's AUS URL and set `AUS_REGION=0`; existing
preferences remain stored. Disable the worker only after its active hunts drain.
Unit/integration tests cover regional queues, private isolation, mixed parties,
capacity fallback, ambiguous failures and account authorization. These checks
do not establish real-client combat completion or end-to-end player latency.

## Hunt cleanup and monitoring

The deploy watchdog checks every minute. `HUNT_MAX_AGE_MINUTES` defaults to 120:
hunts and tutorials stop after two hours, including occupied instances.
`HUNT_EMPTY_MINUTES` defaults to 10: an earlier stop requires continuously fresh
native zero-connection samples. Missing or stale telemetry resets the empty
timer. Ramsgate and Training Grounds are exempt. The original child-process
handle is used, and ports return to the allocator only after process exit.

The main owner dashboard accepts `DASHBOARD_AUS_URL` in addition to
`DASHBOARD_WORKER_URL`. Each worker has its own CPU/RAM, health, processes and
hunt view. Fleet RAM and hunts are summed; CPU is an explicitly labelled
equal-weight arithmetic mean. A stale host makes combined totals unavailable.
