# Temporary account suspensions

The dashboard defaults to seven days (168 hours), permits 1–720 hours, requires
a reason, and supports revocation. These are operator-issued account suspensions,
not automatic cheat detections. No IP is attached to dashboard suspensions.
They block backend authentication/access while active; they do not forcibly
disconnect an already-running native hunt.

`BanFor` checks expiry on each access, so no timer or cron job is needed. Existing
permanent bans retain a NULL expiry. History retains the original expiry, reason,
actor account ID and issue/revoke time. Expired suspensions disappear from the
active list without deleting history. Both lists require administrator auth and
page 50 records at a time. UI values use textContent, and responses are not cached.

Migration `0029_temporary_bans` adds nullable expires_at columns to account_bans
and moderation_events. Back up the database using SQLite's backup API and verify
integrity before applying it; back up changed runtime files and configuration too.
Live installations may have a different migration journal numbering: preserve
their existing entries and append this migration with a later timestamp.

Validate backend health, administrator-only history access, seven-day expiry and
dashboard controls after restarting only the metagame and dashboard. No game
worker restart is required for this feature.

Rollback must not restore an old whole database over new player progress. Keep
the added columns, disable the new UI if necessary, and retain the column-aware
moderation writer and expiry predicate. Older INSERT INTO account_bans VALUES
statements assume six columns and are incompatible with the added column; do not
blindly restore that controller. Revoke a mistaken suspension through moderation
so the reversal is audited.

Validation: 758 backend tests, 12 dashboard tests, and backend build passed.
Native RPC hardening is documented separately in anticheat-2026-10-15.md.
