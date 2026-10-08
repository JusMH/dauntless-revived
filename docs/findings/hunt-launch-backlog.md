# October 8 launch backlog

Germany was accepting 61 pending launches with ten seconds of pacing per spawn.
That backlog alone exceeds the 120-second remote request deadline, so requests
could fail before their processes even started. Running capacity is not a safe
limit for the number of launches waiting to spawn.

HuntAdmission now allows at most two pending spawns per worker. Rejections use
the existing capacity response and polling retry path. The reservation releases
at spawn, so this does not cap running hunts at two. CPU, memory and port limits
still apply. Existing queued work was cleared by restarting the game workers.

Validation: 40 tests passed across capacity, catalog contracts, regions, game
servers, matchmaking and launch latency. The catalog contract covers 138 rows
including 53 pursuit, 26 patrol and 15 escalation rows. Trials are selected by
the separate rotating arena path. These checks do not establish full in-game
completion or resolve the reported client-specific invisible behemoths.
