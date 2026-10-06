import { RemoveTestDb } from "./setup";
import "./authenv";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { GetDb } from "../src/db";
import { inventory } from "../src/db/schema";
import { CreateStorePurchase, GrantKind, ListStoreOffers, MiddlemanWindowStart, RedeemStorePurchase, SelectWeeklyMiddlemanOffers } from "../src/controllers/freestore";
import { MakePlayer, StackQuantity } from "./helpers";

after(() => {
    RemoveTestDb(() => GetDb().$client.close());
});

beforeEach(() => {
    process.env.STORE = "free";
});

function Credit(CharacterId: string, Quantity: number){
    GetDb().insert(inventory).values({
        characterId: CharacterId,
        instancedItems: "[]",
        stackedItems: JSON.stringify([{catalogId: "CURRENCY_CELLDUST", quantity: Quantity}])
    }).onConflictDoUpdate({
        target: inventory.characterId,
        set: {stackedItems: JSON.stringify([{catalogId: "CURRENCY_CELLDUST", quantity: Quantity}])}
    }).run();
}

describe("Middleman weekly Aetherdust offers", () => {
    it("rotates three stable families at the Thursday 18:00 UTC reset", () => {
        const Before = new Date("2026-10-01T17:59:59.000Z");
        const After = new Date("2026-10-01T18:00:00.000Z");
        const First = SelectWeeklyMiddlemanOffers(Before);
        const Same = SelectWeeklyMiddlemanOffers(new Date("2026-09-30T12:00:00.000Z"));
        const Next = SelectWeeklyMiddlemanOffers(After);

        assert.equal(First.length, 3);
        assert.deepEqual(Same, First);
        assert.equal(new Set(First.map((Offer) => (Offer.items ?? [])[0].catalogId.replace(/_(UC|R)$/, ""))).size, 3);
        assert.ok(Next.every((Offer) => !First.some((Old) => Old.items?.[0]?.catalogId.replace(/_(UC|R)$/, "") === Offer.items?.[0]?.catalogId.replace(/_(UC|R)$/, ""))));
        assert.equal(MiddlemanWindowStart(Before), Date.parse("2026-09-24T18:00:00.000Z"));
        assert.equal(MiddlemanWindowStart(After), Date.parse("2026-10-01T18:00:00.000Z"));
        assert.deepEqual(First.map((Offer) => Offer.cellDustPrice), [80, 80, 200]);
    });

    it("lists only this week's cells and keeps them repeatable", async () => {
        const A = await MakePlayer();
        const Offers = ListStoreOffers(A.UserId, "weekly_cell_offering");

        assert.equal(Offers.length, 3);
        assert.ok(Offers.every((Offer) => Offer.remaining === 1));
        assert.ok(Offers.every((Offer) => Offer.tags.includes("weekly_cell_offering")));
        assert.ok(Offers.every((Offer) => typeof Offer.availableFrom === "string" && typeof Offer.availableTo === "string"));
        assert.ok(Offers.every((Offer) => GrantKind((Offer.items ?? [])[0].catalogId) === "stacked"));
    });

    it("spends Aetherdust atomically and can buy the same weekly cell again", async () => {
        const A = await MakePlayer();
        Credit(A.CharacterId, 500);
        const Offer = ListStoreOffers(A.UserId, "weekly_cell_offering")[0];
        const CatalogId = (Offer.items ?? [])[0].catalogId;
        const Price = Offer.cellDustPrice as number;

        for(let i = 0; i < 2; i++){
            const Token = CreateStorePurchase(A.UserId, "id_currency_celldust", Offer.id).purchaseToken;
            const First = RedeemStorePurchase(A.UserId, "id_currency_celldust", Token);
            const Retry = RedeemStorePurchase(A.UserId, "id_currency_celldust", Token);
            assert.equal(First.Replayed, false);
            assert.equal(Retry.Replayed, true);
        }

        assert.equal(StackQuantity(A.CharacterId, "CURRENCY_CELLDUST"), 500 - Price * 2);
        assert.equal(StackQuantity(A.CharacterId, CatalogId), 2);
        assert.equal(ListStoreOffers(A.UserId, "weekly_cell_offering").find((Candidate) => Candidate.id === Offer.id)?.remaining, 1);
    });
});
