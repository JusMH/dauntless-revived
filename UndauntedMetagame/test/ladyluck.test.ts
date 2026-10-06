import { RemoveTestDb } from "./setup";
import "./authenv";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { StartApp, StopApp } from "./appclient";
import { GetDb } from "../src/db";
import { inventory } from "../src/db/schema";
import { CreateStorePurchase, GetStoreOffer, GrantKind, ListStoreOffers, RedeemStorePurchase } from "../src/controllers/freestore";
import { MakePlayer, StackQuantity } from "./helpers";
import { GrantEntitlementInTx } from "../src/controllers/entitlements";
import { TRIALS_CHAMPION_ENTITLEMENT } from "../src/controllers/trials";

before(async () => {
    await StartApp();
});

after(async () => {
    await StopApp();
    RemoveTestDb(() => GetDb().$client.close());
});

beforeEach(() => {
    process.env.STORE = "free";
    process.env.TRIALS_STORE = "1";
});

function Credit(CharacterId: string, CatalogId: string, Quantity: number){
    GetDb().insert(inventory).values({
        characterId: CharacterId,
        instancedItems: "[]",
        stackedItems: JSON.stringify([{catalogId: CatalogId, quantity: Quantity}])
    }).onConflictDoUpdate({
        target: inventory.characterId,
        set: {stackedItems: JSON.stringify([{catalogId: CatalogId, quantity: Quantity}])}
    }).run();
}

function ReadInstanced(CharacterId: string){
    const Row = GetDb().select().from(inventory).where(eq(inventory.characterId, CharacterId)).get();
    return JSON.parse(Row?.instancedItems ?? "[]") as any[];
}

function Buy(UserId: string, Currency: string, Sku: string){
    const Token = CreateStorePurchase(UserId, Currency, Sku).purchaseToken;
    return RedeemStorePurchase(UserId, Currency, Token);
}

describe("Lady Luck Trials store", () => {
    it("uses the 1.4.4 flat-price shape and hides Champion gear until leaderboard placement is earned", async () => {
        const A = await MakePlayer();
        const Offers = ListStoreOffers(A.UserId, "ladyluckstore");

        assert.equal(Offers.length, 29);
        assert.ok(Offers.every((Offer) => !Object.prototype.hasOwnProperty.call(Offer, "prices")));
        assert.ok(Offers.every((Offer) => Number.isInteger(Offer.steelMarksPrice) !== Number.isInteger(Offer.gildedMarksPrice)));
        assert.equal(GetStoreOffer(A.UserId, "ladyluck_weapon_strikers_normal").gildedMarksPrice, 500);
        assert.equal(GetStoreOffer(A.UserId, "ladyluck_cb_passive_trials_02").steelMarksPrice, 250);
        assert.throws(() => GetStoreOffer(A.UserId, "ladyluck_weapon_strikers_prestige"), {Status: 404});
        assert.throws(() => CreateStorePurchase(A.UserId, "marksgilded", "ladyluck_weapon_strikers_prestige"), {Status: 404});

        GetDb().transaction((tx) => GrantEntitlementInTx(tx, A.UserId, TRIALS_CHAMPION_ENTITLEMENT, 0, "test"));
        assert.equal(ListStoreOffers(A.UserId, "ladyluckstore").length, 43);
        assert.equal(GetStoreOffer(A.UserId, "ladyluck_weapon_strikers_prestige").gildedMarksPrice, 1000);
    });

    it("uses captured instanced-vs-stacked grant kinds instead of guessing from prefixes", () => {
        assert.equal(GrantKind("WP_AC_TRIALS_00"), "instanced");
        assert.equal(GrantKind("AR_TRIALS_CHEST_00"), "instanced");
        assert.equal(GrantKind("CONTAINER_CORE_GOLD_POWER_CELLCORE"), "stacked");
        assert.equal(GrantKind("QI_LANTERN_POTION"), "stacked");
        assert.equal(GrantKind("PR_FRANK"), "instanced");
    });

    it("charges Gilded Marks once, grants an instanced cosmetic once, and then marks it owned", async () => {
        const A = await MakePlayer();
        Credit(A.CharacterId, "CURRENCY_MARKS_GILDED", 700);

        const Token = CreateStorePurchase(A.UserId, "id_currency_marks_gilded", "ladyluck_weapon_strikers_normal").purchaseToken;
        const First = RedeemStorePurchase(A.UserId, "id_currency_marks_gilded", Token);
        const Retry = RedeemStorePurchase(A.UserId, "id_currency_marks_gilded", Token);

        assert.equal(First.Replayed, false);
        assert.equal(Retry.Replayed, true);
        assert.equal(StackQuantity(A.CharacterId, "CURRENCY_MARKS_GILDED"), 200);
        assert.equal(ReadInstanced(A.CharacterId).filter((Item) => Item.catalogId === "WP_AC_TRIALS_00").length, 1);
        assert.equal(GetStoreOffer(A.UserId, "ladyluck_weapon_strikers_normal").remaining, 0);
        assert.throws(() => CreateStorePurchase(A.UserId, "marksgilded", "ladyluck_weapon_strikers_normal"), {Status: 409});
    });

    it("keeps unlimited core offers repeatable and charges each purchase atomically", async () => {
        const A = await MakePlayer();
        Credit(A.CharacterId, "CURRENCY_MARKS_GILDED", 300);

        Buy(A.UserId, "marksgilded", "trials_cell_core_gold_power");
        Buy(A.UserId, "gildedmarks", "trials_cell_core_gold_power");

        assert.equal(StackQuantity(A.CharacterId, "CURRENCY_MARKS_GILDED"), 0);
        assert.equal(StackQuantity(A.CharacterId, "CONTAINER_CORE_GOLD_POWER_CELLCORE"), 2);
        assert.equal(GetStoreOffer(A.UserId, "trials_cell_core_gold_power").remaining, 1);
        assert.throws(() => CreateStorePurchase(A.UserId, "marksgilded", "trials_cell_core_gold_power"), {Status: 409});
    });

    it("charges Steel Marks for one-time gameplay rewards", async () => {
        const A = await MakePlayer();
        Credit(A.CharacterId, "CURRENCY_MARKS_STEEL", 300);

        Buy(A.UserId, "id_currency_marks_steel", "ladyluck_cb_passive_trials_02");

        assert.equal(StackQuantity(A.CharacterId, "CURRENCY_MARKS_STEEL"), 50);
        assert.equal(StackQuantity(A.CharacterId, "PART_CB_PASSIVE_TRIALS_02"), 1);
        assert.equal(GetStoreOffer(A.UserId, "ladyluck_cb_passive_trials_02").remaining, 0);
    });

    it("is hidden behind TRIALS_STORE without exposing single-offer purchases", async () => {
        const A = await MakePlayer();
        process.env.TRIALS_STORE = "0";

        assert.deepEqual(ListStoreOffers(A.UserId, "ladyluckstore"), []);
        assert.throws(() => GetStoreOffer(A.UserId, "ladyluck_weapon_strikers_normal"), {Status: 404});
        assert.throws(() => CreateStorePurchase(A.UserId, "marksgilded", "ladyluck_weapon_strikers_normal"), {Status: 404});
    });
});
