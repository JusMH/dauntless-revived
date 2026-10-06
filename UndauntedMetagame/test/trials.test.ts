import { RemoveTestDb } from "./setup";
import "./authenv";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Call, StartApp, StopApp } from "./appclient";
import { GetDb } from "../src/db";
import { leaderboardprofiles, trialruns } from "../src/db/schema";
import { MakePlayer } from "./helpers";

const TRIAL = "Arena_MatchmakerHunt_Elite_001";

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
    GetDb().delete(leaderboardprofiles).run();
});

function Solo(UserId: string, Time: number, Session: string){
    return {
        difficulty: 1,
        trial_id: TRIAL,
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
    return {difficulty: 1, page: 0, page_size: 100, trial_id: TRIAL, target_platforms: [], ...Extra};
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
        assert.equal(Individual.json.payload.trial_id, TRIAL);
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
            trial_id: TRIAL,
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

    it("returns 404 while the feature switch is off", async () => {
        const A = await MakePlayer();
        process.env.TRIALS_LEADERBOARDS = "0";

        assert.equal((await Call("POST", "/trials/leaderboards/solo", {as: A.UserId, body: Query()})).status, 404);
    });
});
