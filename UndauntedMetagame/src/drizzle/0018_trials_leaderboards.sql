CREATE TABLE `trialruns` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `trialId` text NOT NULL,
    `difficulty` integer NOT NULL,
    `mode` text NOT NULL,
    `runKey` text NOT NULL,
    `groupKey` text NOT NULL,
    `completionTime` integer NOT NULL,
    `objectivesCompleted` integer NOT NULL,
    `sessionId` text NOT NULL,
    `entries` text NOT NULL,
    `submittedDate` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trialruns_trial_difficulty_run` ON `trialruns` (`trialId`,`difficulty`,`runKey`);
--> statement-breakpoint
CREATE INDEX `trialruns_board` ON `trialruns` (`trialId`,`difficulty`,`mode`,`completionTime`);
--> statement-breakpoint
CREATE INDEX `trialruns_group` ON `trialruns` (`trialId`,`difficulty`,`mode`,`groupKey`);
