import { Router } from "express";
import { logger } from "../logger";
import { TrialsSchedule } from "../features";
import { TrialIdForWeek, TrialWeekAt, TrialsWindowForWeek } from "../controllers/trials";

export const tuningRouter = Router();

type ScheduledItem = {
    ID: string,
    MaxCompletionPerInterval: number
};

type Schedule = {
    EndTime: string,
    IsRepeatable: boolean,
    Name: string,
    RepeatableDetails: {
        EachDay: boolean,
        EachWeek: boolean
    },
    ScheduledItems: ScheduledItem[],
    StartTime: string
};

function ServiceDate(EpochSeconds: number){
    const DateValue = new Date(EpochSeconds * 1000);
    const Pad = (Value: number) => String(Value).padStart(2, "0");

    return `${DateValue.getUTCFullYear()}.${Pad(DateValue.getUTCMonth() + 1)}.${Pad(DateValue.getUTCDate())}-${Pad(DateValue.getUTCHours())}.${Pad(DateValue.getUTCMinutes())}.${Pad(DateValue.getUTCSeconds())}`;
}

function OneTimeSchedule(Id: string, StartTime: string, EndTime: string): Schedule {
    return {
        EndTime,
        IsRepeatable: false,
        Name: Id,
        RepeatableDetails: {
            EachDay: false,
            EachWeek: false
        },
        ScheduledItems: [{
            ID: Id,
            MaxCompletionPerInterval: -1
        }],
        StartTime
    };
}

export function GetSeasonalEventSchedule(At: Date = new Date()){
    if(!TrialsSchedule()){
        return {
            code: null,
            message: "OK",
            payload: {
                ScheduledItems: []
            }
        };
    }

    const Week = TrialWeekAt(At);
    const Window = TrialsWindowForWeek(Week, At);
    const StartTime = ServiceDate(Window.trial_start);
    const EndTime = ServiceDate(Window.trial_end);
    const Ids = [
        "CR19_PlayerHunt_Arena_Hard",
        "CR19_PlayerHunt_Arena_Elite",
        TrialIdForWeek(0, Week),
        TrialIdForWeek(1, Week)
    ];

    return {
        code: null,
        message: "OK",
        payload: {
            // FServiceSchedule -> FScheduleData -> FScheduledItem in the 1.4.4 SDK. Advertising both
            // player-hunt and matchmaker ids is deliberate: the native IsHuntUnlocked implementation
            // is opaque, and this lets the live A/B test tell us which id it queries without broadening
            // the schedule to unrelated hunts.
            ScheduledItems: Ids.map((Id) => OneTimeSchedule(Id, StartTime, EndTime))
        }
    };
}

tuningRouter.get("/game_tuning/seasonal_event_schedule", (req: any, res) => {
    logger.info(`Seasonal Event Schedule (${TrialsSchedule() ? "Trials active" : "stubbed"})`);

    res.status(200);
    res.json(GetSeasonalEventSchedule());
});

tuningRouter.get("/game_tuning/huntpass_xp_config", (req: any, res) => {
    logger.info("Huntpass XP Config (stubbed)");

    res.status(200);
    res.json({
        code: null,
        message: "OK",
        payload: {
            EventConfigs: [],
            GlobalConfig: {
                DifficultyBias: 1.000000000000000,
                GlobalMultiplier: 1.000000000000000,
                MaxXPAwarded: 200
            }
        }
    });
});
