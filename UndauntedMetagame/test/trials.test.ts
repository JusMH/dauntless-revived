import { RemoveTestDb } from "./setup";
import "./authenv";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Call, StartApp, StopApp } from "./appclient";
import { GetDb } from "../src/db";
import { entitlements, leaderboardprofiles, trialruns, trialweeks } from "../src/db/schema";
import { MakePlayer } from "./helpers";
import { FinalizeCompletedTrialWeeks, TrialIdForWeek, TrialWeekAt, TRIALS_CHAMPION_ENTITLEMENT } from "../src/controllers/trials";

const Trial = () => TrialIdForWeek(1, TrialWeekAt());

before(async () => {
    await StartApp();
});

after(async () => {
    await StopApp();
    RemoveTestDb(() => GetDb().$client.close());
});

beforeEach(() => {
    process.env.TRIALS_LEADERBOARDS = "1";
    GetDb().delete(trialruns).run();
    GetDb().delete(trialweeks).run();
    GetDb().delete(leaderboardprofiles).run();
});

function Solo(UserId: string, Time: number, Session: string){
    return {
        difficulty: 1,
        trial_id: Trial(),
        completion_time: Time,
        objectives_completed: 3,
        phx_account_id: UserId,
        platform: "WIN",
        platform_name: UserId,
        player_role_id: "PR_FRANK",
        weapon: 2,
        secondary_weapon: 1,
        session_id: Session
    };
}

function Query(Extra = {}){
    return {difficulty: 1, page: 0, page_size: 100, trial_id: Trial(), target_platforms: [], ...Extra};
}

describe("Trials leaderboards", () => {
    it("stores game-server solo results, keeps each player's best time and serves aggregate and individual shapes", async () => {
        const A = await MakePlayer(), B = await MakePlayer();

        for(const Body of [Solo(A.UserId, 42000, "a-slow"), Solo(B.UserId, 39000, "b"), Solo(A.UserId, 37000, "a-fast")]){
            assert.equal((await Call("POST", "/trials/leaderboards", {gs: true, body: Body})).status, 204);
        }

        const SoloBoard = await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query()});
        assert.equal(SoloBoard.status, 200);
        assert.ok(Number.isInteger(SoloBoard.json.payload.trial_start));
        assert.equal(SoloBoard.json.payload.trial_end - SoloBoard.json.payload.trial_start, 7 * 24 * 60 * 60);
        assert.ok(SoloBoard.json.payload.time_to_refresh > 0 && SoloBoard.json.payload.time_to_refresh <= 7 * 24 * 60 * 60);
        assert.deepEqual(SoloBoard.json.payload.entries.map((Entry: any) => [Entry.phx_account_id, Entry.completion_time, Entry.rank]), [
            [A.UserId, 37000, 1],
            [B.UserId, 39000, 2]
        ]);

        const Individual = await Call("POST", "/trials/leaderboards/solo/individual", {as: A.UserId, body: Query({phx_account_id: B.UserId})});
        assert.equal(Individual.status, 200);
        assert.equal(Individual.json.payload.phx_account_id, B.UserId);
        assert.equal(Individual.json.payload.rank, 2);
        assert.equal(Individual.json.payload.trial_id, Trial());
        assert.equal(Individual.json.payload.difficulty, "1");

        const All = await Call("POST", "/trials/leaderboards", {as: A.UserId, body: Query()});
        assert.equal(All.status, 200);
        assert.deepEqual(All.json.payload.world.solo.all.entries.map((Entry: any) => Entry.phx_account_id), [A.UserId, B.UserId]);
        assert.deepEqual(All.json.payload.world.group.entries, []);
    });

    it("stores one group run once on retry and serves group and member lookup", async () => {
        const A = await MakePlayer(), B = await MakePlayer();
        const Body = {
            difficulty: 1,
            trial_id: Trial(),
            completion_time: 51000,
            objectives_completed: 3,
            session_id: "group-session",
            entries: [
                {phx_account_id: A.UserId, platform: "WIN", platform_name: "A", player_role_id: "PR_FRANK", weapon: 2},
                {phx_account_id: B.UserId, platform: "WIN", platform_name: "B", player_role_id: "PR_BASTION", weapon: 5}
            ]
        };

        assert.equal((await Call("POST", "/trials/leaderboards", {gs: true, body: Body})).status, 204);
        assert.equal((await Call("POST", "/trials/leaderboards", {gs: true, body: Body})).status, 204);
        assert.equal(GetDb().select().from(trialruns).all().length, 1);

        const Group = await Call("POST", "/trials/leaderboards/group", {as: A.UserId, body: Query()});
        assert.equal(Group.status, 200);
        assert.equal(Group.json.payload.entries.length, 1);
        assert.deepEqual(Group.json.payload.entries[0].entries.map((Entry: any) => Entry.phx_account_id), [A.UserId, B.UserId]);

        const Individual = await Call("POST", "/trials/leaderboards/group/individual", {as: B.UserId, body: Query({phx_account_id: B.UserId})});
        assert.equal(Individual.status, 200);
        assert.equal(Individual.json.payload.rank, 1);
        assert.equal(Individual.json.payload.session_id, "group-session");
    });

    it("persists the 1.4.4 profile update and uses its latest public identity on leaderboard reads", async () => {
        const A = await MakePlayer();

        const Updated = await Call("POST", "/profile/update", {as: A.UserId, body: {
            dauntlessid: A.UserId,
            epicid: "epic-a",
            platformid: "platform-a",
            currentplatform: "PSN",
            currentdisplayname: "Current Slayer"
        }});
        assert.equal(Updated.status, 200);
        assert.equal(GetDb().select().from(leaderboardprofiles).all().length, 1);

        await Call("POST", "/trials/leaderboards", {gs: true, body: {...Solo(A.UserId, 32000, "profile-run"), platform: "WIN", platform_name: "Old Name"}});
        const Board = await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query()});

        assert.equal(Board.json.payload.entries[0].platform, "PSN");
        assert.equal(Board.json.payload.entries[0].platform_name, "Current Slayer");

        const Spoof = await Call("POST", "/profile/update", {as: A.UserId, body: {
            dauntlessid: "UID-someone-else",
            epicid: "",
            platformid: "",
            currentplatform: "WIN",
            currentdisplayname: "Nope"
        }});
        assert.equal(Spoof.status, 403);
    });

    it("refuses player-submitted scores and malformed results", async () => {
        const A = await MakePlayer();

        assert.equal((await Call("POST", "/trials/leaderboards", {as: A.UserId, body: Solo(A.UserId, 1, "cheat")})).status, 403);
        assert.equal((await Call("POST", "/trials/leaderboards", {gs: true, body: {...Solo(A.UserId, 1, "bad"), trial_id: "not-a-trial"}})).status, 400);
        assert.equal(GetDb().select().from(trialruns).all().length, 0);
    });

    it("filters by target platform and paginates after ranking", async () => {
        const A = await MakePlayer(), B = await MakePlayer();
        await Call("POST", "/trials/leaderboards", {gs: true, body: Solo(A.UserId, 30000, "a")});
        await Call("POST", "/trials/leaderboards", {gs: true, body: {...Solo(B.UserId, 31000, "b"), platform: "PSN"}});

        const Win = await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query({target_platforms: ["WIN"]})});
        assert.deepEqual(Win.json.payload.entries.map((Entry: any) => Entry.phx_account_id), [A.UserId]);

        const PageTwo = await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query({page: 1, page_size: 1})});
        assert.equal(PageTwo.json.payload.entries[0].phx_account_id, B.UserId);
        assert.equal(PageTwo.json.payload.entries[0].rank, 2);
    });

    it("keeps a repeated Trial row isolated by week and rejects stale game-server submissions", async () => {
        const A = await MakePlayer();
        const CurrentWeek = TrialWeekAt();
        const CurrentTrial = TrialIdForWeek(1, CurrentWeek);
        const OldWeek = CurrentWeek - 67;

        GetDb().insert(trialruns).values({
            trialId: CurrentTrial,
            trialWeek: OldWeek,
            difficulty: 1,
            mode: "solo",
            runKey: "old-cycle",
            groupKey: A.UserId,
            completionTime: 1000,
            objectivesCompleted: 3,
            sessionId: "old-cycle",
            entries: JSON.stringify([{phx_account_id: A.UserId, platform: "WIN", platform_name: "Old", player_role_id: "PR_FRANK", weapon: 2}]),
            submittedDate: "2025-01-01T00:00:00.000Z"
        }).run();

        assert.equal((await Call("POST", "/trials/leaderboards", {gs: true, body: Solo(A.UserId, 30000, "current-cycle")})).status, 204);
        const Current = await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query()});
        assert.deepEqual(Current.json.payload.entries.map((Entry: any) => Entry.completion_time), [30000]);

        const PreviousTrial = TrialIdForWeek(1, CurrentWeek - 1);
        assert.equal((await Call("POST", "/trials/leaderboards", {
            gs: true,
            body: {...Solo(A.UserId, 25000, "stale"), trial_id: PreviousTrial}
        })).status, 409);
    });

    it("finalizes a completed Dauntless week once and permanently unlocks Champion access", () => {
        const CurrentWeek = TrialWeekAt();
        const PreviousWeek = CurrentWeek - 1;
        const TrialId = TrialIdForWeek(1, PreviousWeek);
        const SoloId = "UID-trials-champion-solo";
        const GroupIds = ["UID-trials-champion-g1", "UID-trials-champion-g2"];

        GetDb().insert(trialruns).values([
            {
                trialId: TrialId,
                trialWeek: PreviousWeek,
                difficulty: 1,
                mode: "solo",
                runKey: "champion-solo",
                groupKey: SoloId,
                completionTime: 30000,
                objectivesCompleted: 3,
                sessionId: "champion-solo",
                entries: JSON.stringify([{phx_account_id: SoloId, platform: "WIN", platform_name: "Solo", player_role_id: "PR_FRANK", weapon: 2}]),
                submittedDate: "2026-01-01T00:00:00.000Z"
            },
            {
                trialId: TrialId,
                trialWeek: PreviousWeek,
                difficulty: 1,
                mode: "group",
                runKey: "champion-group",
                groupKey: GroupIds.join(":"),
                completionTime: 31000,
                objectivesCompleted: 3,
                sessionId: "champion-group",
                entries: JSON.stringify(GroupIds.map((Id) => ({phx_account_id: Id, platform: "WIN", platform_name: Id, player_role_id: "PR_FRANK", weapon: 2}))),
                submittedDate: "2026-01-01T00:00:01.000Z"
            }
        ]).run();

        assert.deepEqual(FinalizeCompletedTrialWeeks(), {FinalizedWeeks: 1, AwardedAccounts: 3});
        assert.deepEqual(FinalizeCompletedTrialWeeks(), {FinalizedWeeks: 0, AwardedAccounts: 0});
        assert.equal(GetDb().select().from(trialweeks).all().length, 1);

        for(const AccountId of [SoloId, ...GroupIds]){
            assert.equal(GetDb().select().from(entitlements).where(eq(entitlements.accountId, AccountId)).all()
                .some((Row) => Row.name === TRIALS_CHAMPION_ENTITLEMENT && Row.duration === 0 && Row.revokedDate == null), true);
        }
    });

    it("returns 404 while the feature switch is off", async () => {
        const A = await MakePlayer();
        process.env.TRIALS_LEADERBOARDS = "0";

        assert.equal((await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query()})).status, 404);
    });
});
