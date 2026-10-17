# Rams shop production candidate

This is a reviewed release candidate, **not a record of production deployment**. The isolated player test confirmed the Monk chestpiece and armour kit purchases: 100,000 Rams became 88,500, with matching database receipts. The user then confirmed purchases, balance and a normal vendor with the exact production DLL (SHA256 `1F3B2F7EF3C277EF2A1A8440546539253BCF7FBBC707DBF57BA69EB054500CF9`); the backend subsequently returned 86,000 for both uppercase balance keys.

## Configuration and compatibility

Use the matching launcher **0.1.36**, which enables the native `-RamsStore` bridge, with:

```
STORE=free
STORE_RAMS=1
STORE_RAMS_EVENT_TRANSPORT=1
STORE_WEEKLY_ROTATION=1
```

The updated client supplies `shop_protocol=rams-v1`. Main-shop list, item-detail and token requests without that marker receive HTTP 426 and an update instruction. The marker is a compatibility signal, not authentication; account ownership, prices and funds remain server-validated. Other vendor requests retain their existing behavior. For an isolated account pilot instead of global activation, leave `STORE_RAMS` unset and set `STORE_RAMS_TEST_ACCOUNT` to the disposable account UID.

Accounting uses `notesPrice`/`notes` and the real `CURRENCY_NOTES` inventory balance. The old client cannot parse `notesPrice`, so the native bridge transports marked offers through `event01Price`. Its uppercase `CURRENCY_EVENT_01` balance alias mirrors the same Rams balance; it is not a separate wallet. Uppercase `CURRENCY_NOTES` and `CURRENCY_EVENT_01` are required by the native parser; lowercase aliases did not populate its purchase balance.

## Prices and weekly stock

Sigils/flares cost 500; individual armour, emotes, banner fabrics/standards and lantern cosmetics 1,500; weapon skins 5,000; dyes, including supported entitlement-only dyes, 10,000. Four-piece armour kits cost 10,000; other supported bundles sum their contents up to 10,000. Unsupported offers retain existing pricing.

The entire main-shop stock rotates Monday at 00:00 UTC: up to three offers per category, with eight selected offers featured. Selection is deterministic across restarts. Both token creation and redemption enforce current stock. Removed offers or changed offer hashes reject outstanding tokens without charging. The native category fix maps visible tab labels to model indices so hidden empty categories do not shift the displayed stock.

## Validation and rollout gate

**54 targeted tests passed**, covering pricing, production compatibility, account isolation, exact balance deductions, missing/invalid balances, competing purchase tokens, paid overlapping bundles, replay and weekly stock enforcement. Corrupt inventory fails closed without being reset. Deduction, grants and redemption receipt share an immediate database transaction; retries cannot charge twice or duplicate cosmetic grants.

Before deployment, smoke-test the final exact launcher/DLL with a disposable account: shop tabs, Rams display, one purchase, reconnect persistence, low-balance rejection and unchanged vendor currencies. A successful earlier pilot does not establish that the final packaged binary passed. Take a fresh verified backup and stage the reviewed rollout after this gate.

## Rollback

Restore the reviewed previous backend/client code and previous environment flags; unset `STORE_RAMS`, `STORE_RAMS_EVENT_TRANSPORT`, `STORE_WEEKLY_ROTATION` and any `STORE_RAMS_TEST_ACCOUNT` pilot setting as appropriate. No schema migration is required. **Do not restore an old database to roll back shop code**: preserve purchases, balances and player progression. Changing pricing/stock can invalidate outstanding tokens safely; clients should refresh the shop and retry.
