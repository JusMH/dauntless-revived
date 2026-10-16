# Behemoth break visuals: investigation

Player report: Gnasher, Embermane and apparently other Behemoths keep broken parts attached, but the part reward arrives. This distinguishes the reported failure from missing inventory rewards; the underlying cause is not yet verified.

The SDK exposes separate `monsterpart_bpc_C` properties `CurrentBreakStage` and `PartSevered`, with `OnRep_CurrentBreakStage` and `OnRep_PartSevered` callbacks. `SeverPartOnPartBreak` is authored per part, so not every rewarded break necessarily represents a severable part. Compare an actual severable tail on server and client before forcing any visual state.

The native debug guard gates only `NetServer` functions with ten exact names. The listed break/replication callbacks are not denylisted; regression coverage explicitly preserves them. This rules out direct rejection by that denylist, not every possible regression in native networking.

Next reproduction: an isolated Gnasher or Embermane tail break, recording the server/client component's current stage, `PartSevered`, `SeverPartOnPartBreak`, and whether the client's replication callback runs. If server state is correct and client state is stale, trace component replication/relevancy; if client state is correct, trace callback and mesh updates. Preserve rewards and avoid invoking break/grant functions a second time. No visual fix has been deployed or claimed.
