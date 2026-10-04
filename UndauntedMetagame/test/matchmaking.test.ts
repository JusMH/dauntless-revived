import { RemoveTestDb } from "./setup";
import "./matchmakingenv";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CancelMatchmaking, CheckAndUpdateQueueStatus, DistinctPlayers, HandlePlayerMatchmaking, ResetMatchmakingForTests } from "../src/controllers/matchmaking";
import { GetDb } from "../src/db";
import { GameSessionForCandidate } from "../src/controllers/matchmaking";

// Matchmaking looks up the player's party (controllers/party.ts), which loads the database
after(() => RemoveTestDb(() => GetDb().$client.close()));

describe("CancelMatchmaking (DELETE /candidate)", () => {
    it("takes the player out of the queue, so the status poll can no longer send them to the hunt", async () => {
        assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-a"), true);
        assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-b"), true);

        const Cancelled = CancelMatchmaking("UID-a");
        assert.equal(Cancelled?.HuntId, "Hunt_Test_A");
        assert.equal(await CheckAndUpdateQueueStatus("UID-a"), undefined);
        assert.equal((await CheckAndUpdateQueueStatus("UID-b"))?.Ready, false);

        // The last player leaving drops the queue, so a new group can start one
        CancelMatchmaking("UID-b");
        assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-c"), true);
        assert.equal((await CheckAndUpdateQueueStatus("UID-c"))?.HuntId, "Hunt_Test_A");
    });

    it("is a no-op for a player who is not queued", () => {
        assert.equal(CancelMatchmaking("UID-nobody"), undefined);
    });
});

describe("DistinctPlayers (the expected-player list sent to the deploy server)", () => {
    it("lists each account once, in first-seen order", () => {
        // The live list on 22 September 2026 was V, V, O: the hunt server waited for a third player
        assert.deepEqual(DistinctPlayers(["UID-v", "UID-v", "UID-o"]), ["UID-v", "UID-o"]);
        assert.deepEqual(DistinctPlayers(["UID-o", "UID-v", "UID-o", "UID-v"]), ["UID-o", "UID-v"]);
        assert.deepEqual(DistinctPlayers([]), []);
    });
});


describe("concurrent hunt queues", () => {
    it("separate city candidates share the native game session for zone chat", async () => {
        ResetMatchmakingForTests();
        const originalFetch=globalThis.fetch;
        globalThis.fetch=(async()=>new Response(JSON.stringify({host:"127.0.0.1",port:39009,sessionId:"native-city-1"}),{status:200,headers:{"content-type":"application/json"}})) as typeof fetch;
        try {
            await HandlePlayerMatchmaking("CITY","","","UID-a");
            await HandlePlayerMatchmaking("CITY","","","UID-b");
            const a=await CheckAndUpdateQueueStatus("UID-a"), b=await CheckAndUpdateQueueStatus("UID-b");
            assert.ok(a && b); assert.notEqual(a.CandidateId,b.CandidateId);
            assert.equal(GameSessionForCandidate(a),"native-city-1");
            assert.equal(GameSessionForCandidate(b),"native-city-1");
        } finally {globalThis.fetch=originalFetch; ResetMatchmakingForTests();}
    });
    it("private solo hunts never absorb public players or another private player", async () => {
        ResetMatchmakingForTests();
        const originalFetch = globalThis.fetch;
        const rosters: string[][] = [];
        globalThis.fetch = (async (_url: any, init: any) => {
            rosters.push(JSON.parse(init.body).ExpectedPlayers);
            return new Response(JSON.stringify({host: "127.0.0.1", port: 39000 + rosters.length}), {status:200, headers:{"content-type":"application/json"}});
        }) as typeof fetch;
        try {
            await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-public");
            await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-private", true);
            await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-private2", true);
            await new Promise(resolve=>setTimeout(resolve,20));
            assert.deepEqual(rosters, [["UID-private"], ["UID-private2"]]);
            assert.equal((await CheckAndUpdateQueueStatus("UID-public"))?.Ready, false);
            assert.equal((await CheckAndUpdateQueueStatus("UID-private"))?.Ready, true);
        } finally { globalThis.fetch = originalFetch; ResetMatchmakingForTests(); }
    });
    it("switching a waiting public join to private removes it from the shared roster", async () => {
        ResetMatchmakingForTests();
        const originalFetch = globalThis.fetch;
        const rosters: string[][] = [];
        globalThis.fetch = (async (_url: any, init: any) => {
            rosters.push(JSON.parse(init.body).ExpectedPlayers);
            return new Response(JSON.stringify({host:"127.0.0.1",port:39001}),{status:200,headers:{"content-type":"application/json"}});
        }) as typeof fetch;
        try {
            for (const id of ["UID-a","UID-b"]) await HandlePlayerMatchmaking("ISLAND","","Hunt_Test_A",id);
            await HandlePlayerMatchmaking("ISLAND","","Hunt_Test_A","UID-a",true);
            for (const id of ["UID-c","UID-d","UID-e"]) await HandlePlayerMatchmaking("ISLAND","","Hunt_Test_A",id);
            await new Promise(resolve=>setTimeout(resolve,20));
            assert.deepEqual(rosters,[["UID-a"],["UID-b","UID-c","UID-d","UID-e"]]);
        } finally { globalThis.fetch=originalFetch; ResetMatchmakingForTests(); }
    });
    it("keeps a duplicate join on the same candidate", async () => {
        ResetMatchmakingForTests();
        assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-a"), true);
        const first = await CheckAndUpdateQueueStatus("UID-a");
        assert.ok(first);
        assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-a"), true);
        const second = await CheckAndUpdateQueueStatus("UID-a");
        assert.equal(second?.CandidateId, first.CandidateId);
    });

    it("opens the next batch while a full batch is still allocating", async () => {
        ResetMatchmakingForTests();
        const originalFetch = globalThis.fetch;
        let release: (() => void) | undefined;
        let calls = 0;

        globalThis.fetch = (async () => {
            calls++;
            await new Promise<void>((resolve) => { release = resolve; });
            return new Response(JSON.stringify({host: "127.0.0.1", port: 39000}), {
                status: 200,
                headers: {"content-type": "application/json"}
            });
        }) as typeof fetch;

        try{
            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-a"), true);
            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-b"), true);
            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-c"), true);

            const fourth = HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-d");
            const returned = await Promise.race([
                fourth.then(() => true),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 250))
            ]);
            assert.equal(returned, true);
            assert.equal(calls, 1);

            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-e"), true);
            const fifth = await CheckAndUpdateQueueStatus("UID-e");
            assert.ok(fifth);
            assert.equal(fifth.Ready, false);

            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_B", "UID-a"), true);
            assert.equal(await HandlePlayerMatchmaking("ISLAND", "", "Hunt_Test_A", "UID-a"), true);
            const newer = await CheckAndUpdateQueueStatus("UID-a");
            assert.ok(newer);

            release?.();
            await new Promise<void>((resolve) => setTimeout(resolve, 20));

            const afterOldLaunch = await CheckAndUpdateQueueStatus("UID-a");
            assert.equal(afterOldLaunch?.CandidateId, newer.CandidateId);
            assert.equal(afterOldLaunch?.Ready, false);
        }
        finally{
            release?.();
            globalThis.fetch = originalFetch;
            ResetMatchmakingForTests();
        }
    });
});
