-- One time, on the first start after this update: every character's daily token stacks are
-- set to the new daily amounts (TOKEN_DAILY_PATROL_BONUS 10, TOKEN_BOUNTY_DRAFT 6), added
-- where missing. From then on the daily top-ups in controllers/inventory.ts keep them there.
UPDATE `inventories` SET `stackedItems` = (
    SELECT json_group_array(CASE json_extract(`value`, '$.catalogId')
        WHEN 'TOKEN_DAILY_PATROL_BONUS' THEN json_set(`value`, '$.quantity', 10)
        WHEN 'TOKEN_BOUNTY_DRAFT' THEN json_set(`value`, '$.quantity', 6)
        ELSE json(`value`) END)
    FROM json_each(`inventories`.`stackedItems`)
)
WHERE json_valid(`stackedItems`);
--> statement-breakpoint
UPDATE `inventories` SET `stackedItems` = json_insert(`stackedItems`, '$[#]', json_object('catalogId', 'TOKEN_DAILY_PATROL_BONUS', 'quantity', 10))
WHERE json_valid(`stackedItems`) AND NOT EXISTS (SELECT 1 FROM json_each(`stackedItems`) WHERE json_extract(`value`, '$.catalogId') = 'TOKEN_DAILY_PATROL_BONUS');
--> statement-breakpoint
UPDATE `inventories` SET `stackedItems` = json_insert(`stackedItems`, '$[#]', json_object('catalogId', 'TOKEN_BOUNTY_DRAFT', 'quantity', 6))
WHERE json_valid(`stackedItems`) AND NOT EXISTS (SELECT 1 FROM json_each(`stackedItems`) WHERE json_extract(`value`, '$.catalogId') = 'TOKEN_BOUNTY_DRAFT');
