import "./setup";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { BuildTrialSuffixes, DescribeGameservers, Gameserver, Gameservers, GetTrialsData, KindOfGameserver, TRIAL_ROTATION_START, TRIAL_ROTATION_SUFFIXES } from "../src/controllers/gameservers";
import { IsLoopbackAddress } from "../src/routes/gameservers";
import { app } from "../src/app";

// A spare port for this test only (61010-61029 and 62000-62099 are the test ranges)
const TEST_PORT = 62013;

function Fake(Overrides: Partial<Gameserver>): Gameserver {
    return {
        id: "00000000-0000-4000-8000-000000000000",
        port: 8770,
        map: "/Game/Maps/islands/1702/cora_jamima",
        behemoth: undefined,
        matchmakerHuntId: undefined,
        expectedPlayers: undefined,
        isRamsgate: false,
        isTrainingDojo: false,
        processId: process.pid,
        startTime: new Date("2026-09-21T12:00:00.000Z"),
        ...Overrides
    };
}

const Ramsgate = Fake({ id: "11111111-1111-4111-8111-111111111111", port: 8777, map: "/Game/Maps/ramsgate/ramsgate_01_persistent", isRamsgate: true });
const Dojo = Fake({ id: "22222222-2222-4222-8222-222222222222", port: 8776, map: "/Game/Maps/islands/dojo/training_dojo_persistent", isTrainingDojo: true });
const Tutorial = Fake({
    id: "33333333-3333-4333-8333-333333333333", port: 8775,
    map: "/Game/Maps/islands/1705/dia_moss_triforce",
    behemoth: "/Game/Monsters/mcrollin/mcbeaver_tutorial_bp.mcbeaver_tutorial_bp_C"
});
const Hunt = Fake({
    id: "44444444-4444-4444-8444-444444444444", port: 8774,
    map: "/Game/Maps/islands/1705/dia_moss_triforce_2?game=/Game/Blueprints/GameMode/Some_GameMode.Some_GameMode_C",
    behemoth: "/Game/Monsters/lerawr/lerawr_beta_bp.lerawr_beta_bp_C",
    matchmakerHuntId: "CR19_MatchmakerHunt_Lerawr_Beta",
    expectedPlayers: [
        { playerUid: "UID-a", playerHuntId: "CR19_PlayerHunt_FTUE_Pursuit_Beta_LeRawr" },
        { playerUid: "UID-b", playerHuntId: "CR19_PlayerHunt_FTUE_Pursuit_Beta_LeRawr" }
    ]
});

describe("Trials weekly rotation", () => {
    it("uses exactly the rows cooked in both Hard and Elite tables", () => {
        assert.equal(TRIAL_ROTATION_SUFFIXES.length, 88);
        assert.equal(new Set(TRIAL_ROTATION_SUFFIXES).size, 88);
        assert.equal(TRIAL_ROTATION_SUFFIXES[0], "001");
        assert.equal(TRIAL_ROTATION_SUFFIXES.at(-1), "088");
    });

    it("intersects actual row ids and does not crash or renumber gaps", () => {
        const Hard = {
            Arena_MatchmakerHunt_Hard_001: {},
            Arena_MatchmakerHunt_Hard_003: {},
            Arena_MatchmakerHunt_Hard_099: {},
            Arena_MatchmakerHunt_Hard_Test: {}
        };
        const Elite = {
            Arena_MatchmakerHunt_Elite_001: {},
            Arena_MatchmakerHunt_Elite_003: {},
            Arena_MatchmakerHunt_Elite_004: {},
            Arena_MatchmakerHunt_Elite_Test: {}
        };

        assert.deepEqual(BuildTrialSuffixes(Hard, Elite), ["001", "003"]);
    });

    it("maps the cooked weekly ids to their historical Thursday 18:00 UTC reset", () => {
        const Start = new Date(TRIAL_ROTATION_START);
        const OneMsBefore = new Date(Start.getTime() - 1);
        const SameWeek = new Date(Start.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
        const NextWeek = new Date(Start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const Release144 = new Date("2020-11-05T18:00:00.000Z");

        assert.equal(Start.toISOString(), "2019-07-18T18:00:00.000Z");
        assert.ok(GetTrialsData(false, Start).TrialsHuntId.endsWith("_001"));
        assert.ok(GetTrialsData(false, Release144).TrialsHuntId.endsWith("_069"));

        const First = GetTrialsData(false, Start);
        assert.notEqual(GetTrialsData(false, OneMsBefore).TrialsHuntId, First.TrialsHuntId);
        assert.deepEqual(GetTrialsData(false, SameWeek), First);
        assert.notEqual(GetTrialsData(false, NextWeek).TrialsHuntId, First.TrialsHuntId);
    });

    it("uses the same row suffix for Normal and Dauntless and wraps after the cooked rotation", () => {
        const Start = new Date(TRIAL_ROTATION_START);
        const Normal = GetTrialsData(false, Start);
        const Dauntless = GetTrialsData(true, Start);
        const Wrapped = GetTrialsData(false, new Date(Start.getTime() + TRIAL_ROTATION_SUFFIXES.length * 7 * 24 * 60 * 60 * 1000));

        assert.equal(Normal.TrialsHuntId.replace("_Hard_", "_"), Dauntless.TrialsHuntId.replace("_Elite_", "_"));
        assert.equal(Wrapped.TrialsHuntId, Normal.TrialsHuntId);
        assert.ok(Normal.Behemoth.includes("/Game/Monsters/"));
        assert.ok(Dauntless.Behemoth.includes("/Game/Monsters/"));
    });

    it("accepts a host override for the epoch and rejects a bad one", () => {
        const Old = process.env.TRIAL_ROTATION_START;

        try{
            process.env.TRIAL_ROTATION_START = "2026-10-01T00:00:00.000Z";
            assert.ok(GetTrialsData(false, new Date("2026-10-01T12:00:00.000Z")).TrialsHuntId.endsWith(`_${TRIAL_ROTATION_SUFFIXES[0]}`));

            process.env.TRIAL_ROTATION_START = "not-a-date";
            assert.throws(() => GetTrialsData(false, new Date()), /Invalid TRIAL_ROTATION_START/);
        }
        finally{
            if(Old === undefined) delete process.env.TRIAL_ROTATION_START;
            else process.env.TRIAL_ROTATION_START = Old;
        }
    });
});

describe("KindOfGameserver", () => {
    it("tells Ramsgate, the Dojo, the tutorial and hunts apart", () => {
        assert.equal(KindOfGameserver(Ramsgate), "city");
        assert.equal(KindOfGameserver(Dojo), "dojo");
        assert.equal(KindOfGameserver(Tutorial), "tutorial");
        assert.equal(KindOfGameserver(Hunt), "hunt");
    });

    it("does not take dia_moss_triforce_2 (a regular hunt map) for the tutorial island", () => {
        assert.equal(KindOfGameserver(Fake({ map: "/Game/Maps/islands/1705/dia_moss_triforce_2", behemoth: "/Game/Monsters/lerawr/lerawr_normal_bp.lerawr_normal_bp_C" })), "hunt");
        assert.equal(KindOfGameserver(Fake({ map: "/Game/Maps/islands/1705/dia_moss_triforce", behemoth: undefined })), "tutorial");
    });
});

describe("DescribeGameservers", () => {
    it("reports each server's port, kind, map, behemoth, hunt, expected players, limit and start", () => {
        const [City, Training, Solo, Group] = DescribeGameservers([Ramsgate, Dojo, Tutorial, Hunt], () => true);

        assert.deepEqual(City, {
            id: Ramsgate.id, port: 8777, kind: "city", map: "/Game/Maps/ramsgate/ramsgate_01_persistent", gameMode: null,
            behemoth: null, huntId: null, matchmakerHuntId: null, expectedPlayers: [], maxPlayers: null, startedAt: "2026-09-21T12:00:00.000Z"
        });
        assert.equal(Training.kind, "dojo");
        assert.equal(Training.maxPlayers, 12);
        assert.equal(Solo.kind, "tutorial");
        assert.equal(Solo.maxPlayers, 1);
        assert.equal(Solo.behemoth, "/Game/Monsters/mcrollin/mcbeaver_tutorial_bp.mcbeaver_tutorial_bp_C");
        assert.deepEqual(Group, {
            id: Hunt.id, port: 8774, kind: "hunt", map: "/Game/Maps/islands/1705/dia_moss_triforce_2",
            gameMode: "/Game/Blueprints/GameMode/Some_GameMode.Some_GameMode_C",
            behemoth: "/Game/Monsters/lerawr/lerawr_beta_bp.lerawr_beta_bp_C",
            huntId: "CR19_PlayerHunt_FTUE_Pursuit_Beta_LeRawr", matchmakerHuntId: "CR19_MatchmakerHunt_Lerawr_Beta",
            expectedPlayers: ["UID-a", "UID-b"], maxPlayers: 4, startedAt: "2026-09-21T12:00:00.000Z"
        });
    });

    it("leaves out a server whose process has exited", () => {
        const Listed = DescribeGameservers([Ramsgate, Hunt], (ProcessId) => ProcessId !== 999999 && ProcessId === process.pid);
        assert.equal(Listed.length, 2);
        assert.deepEqual(DescribeGameservers([Ramsgate, Fake({ processId: 999999 })], (ProcessId) => ProcessId === process.pid).map((Server) => Server.port), [8777]);
    });

    it("reads a trials hunt's limit from the trials tables and has no limit for an unknown hunt", () => {
        assert.equal(DescribeGameservers([Fake({ matchmakerHuntId: "Arena_MatchmakerHunt_Hard_001" })], () => true)[0].maxPlayers, 4);
        assert.equal(DescribeGameservers([Fake({ matchmakerHuntId: "No_Such_Hunt" })], () => true)[0].maxPlayers, null);
    });
});

describe("GET /gameservers", () => {
    let Listening: Server | undefined;

    after(() => {
        Listening?.close();
        Gameservers.length = 0;
    });

    it("answers the running servers to a loopback caller", async () => {
        Gameservers.push(Ramsgate, Hunt);
        Listening = await new Promise<Server>((Resolve, Reject) => {
            const Started = app.listen(TEST_PORT, "127.0.0.1", (Error?: Error) => Error ? Reject(Error) : Resolve(Started));
        });

        const Reply = await fetch(`http://127.0.0.1:${TEST_PORT}/gameservers`);
        assert.equal(Reply.status, 200);
        const Body: any = await Reply.json();
        assert.deepEqual(Body.servers.map((Server: any) => [Server.port, Server.kind, Server.huntId]), [[8777, "city", null], [8774, "hunt", "CR19_PlayerHunt_FTUE_Pursuit_Beta_LeRawr"]]);
    });

    it("refuses anyone not on loopback", () => {
        for(const Address of ["127.0.0.1", "127.8.9.10", "::1", "::ffff:127.0.0.1"]){
            assert.equal(IsLoopbackAddress(Address), true, Address);
        }

        for(const Address of ["100.64.0.7", "192.168.1.20", "::ffff:100.101.102.103", "fe80::1", "0.0.0.0", "", undefined]){
            assert.equal(IsLoopbackAddress(Address), false, String(Address));
        }
    });
});
