# Replication channel index repair

Germany Ramsgate measured approximately 5.4 ticks/s with 15 connections, with
137.6 ms per tick in native replication. This establishes a server bottleneck,
not the exact cause of every reported lag event. Normal process priority did
not improve a subsequent uncontrolled sample and was reverted.

The per-tick channel index became stale after OpenChannels removals/reordering.
The old fallback rescanned the full channel array separately for every remaining
actor. Repair the index once on a stale hit, then use indexed lookups. Missing
actors still scan for channels created during replication; no actor visibility,
owner isolation or update cadence changes.

The 1000-channel removal regression falls from roughly 500000 actor checks to
under 3000. Channel mutation, owner relevancy, cadence and frame-limit tests pass.
Release x64 builds with VCToolsVersion=14.44.35207; the older locally selected
compiler rejects generated SDK template static_asserts.

Live deployment uses a rolling DLL replacement: existing worlds retain the old
loaded image; new worlds load the fixed binary. Germany Ramsgate was restarted
separately and returned on port18897. Restarted/low-occupancy FPS is not a valid
like-for-like benchmark against the previously populated city.
