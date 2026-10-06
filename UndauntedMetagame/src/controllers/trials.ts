import crypto from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { GetDb } from "../db";
import { leaderboardprofiles, trialruns, trialweeks } from "../db/schema";
import { GrantEntitlementInTx } from "./entitlements";

export type TrialMode = "solo" | "group";

export type TrialPlayer = {
    phx_account_id: string,
    platform: string,
    platform_name: string,
    player_role_id: string,
    weapon: number,
    secondary_weapon?: number
};

type StoredTrialRun = {
    id: number,
    trialId: string,
    trialWeek: number,
    difficulty: number,
    mode: string,
    runKey: string,
    groupKey: string,
    completionTime: number,
    objectivesCompleted: number,
    sessionId: string,
    entries: string,
    submittedDate: string
};

export class TrialsError extends Error {
    constructor(public Status: number, message: string){
        super(message);
        this.name = "TrialsError";
    }
}

const TrialIdPattern = /^Arena_MatchmakerHunt_(Hard|Elite)_\d{3}$/;

// UPlayerArenaComponent and the 1.4.4 leaderboard response view-model both carry the
// current Trial window. Keep this epoch identical to the deploy server's rotation epoch.
export const TRIAL_ROTATION_START = "2020-11-05T00:00:00.000Z";
export const TRIAL_ROTATION_LENGTH = 67;
export const TRIALS_CHAMPION_ENTITLEMENT = "trials_leaderboard_placement";
const TRIAL_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Mod(Value: number, Divisor: number){
    return ((Value % Divisor) + Divisor) % Divisor;
}

function TrialEpoch(){
    const Epoch = Date.parse(process.env.TRIAL_ROTATION_START ?? TRIAL_ROTATION_START);

    if(Number.isNaN(Epoch)){
        throw new TrialsError(500, "TRIAL_ROTATION_START is invalid");
    }

    return Epoch;
}

export function TrialWeekAt(At: Date = new Date()){
    return Math.floor((At.getTime() - TrialEpoch()) / TRIAL_WEEK_MS);
}

export function TrialIdForWeek(DifficultyValue: number, Week: number){
    if(DifficultyValue !== 0 && DifficultyValue !== 1){
        throw new TrialsError(400, "difficulty is invalid");
    }

    const Prefix = DifficultyValue === 1 ? "Elite" : "Hard";
    const Suffix = String(Mod(Week, TRIAL_ROTATION_LENGTH) + 1).padStart(3, "0");
    return `Arena_MatchmakerHunt_${Prefix}_${Suffix}`;
}

function TrialWeekForId(TrialIdValue: string, DifficultyValue: number, At: Date = new Date()){
    const Match = TrialIdPattern.exec(TrialIdValue);

    if(Match == null){
        throw new TrialsError(400, "trial_id is invalid");
    }

    const ExpectedPrefix = DifficultyValue === 1 ? "Elite" : "Hard";
    if(Match[1] !== ExpectedPrefix){
        throw new TrialsError(400, "trial_id does not match difficulty");
    }

    const Suffix = Number(TrialIdValue.slice(-3));
    if(!Number.isSafeInteger(Suffix) || Suffix < 1 || Suffix > TRIAL_ROTATION_LENGTH){
        throw new TrialsError(400, "trial_id is outside the restored rotation");
    }

    // The client has Current/Previous date tabs, while the HTTP body identifies the actual
    // trial row. Map a row to its most recent occurrence so the 67-week wrap never leaks a
    // score from the previous cycle into the current board.
    const CurrentWeek = TrialWeekAt(At);
    const CurrentIndex = Mod(CurrentWeek, TRIAL_ROTATION_LENGTH);
    const TargetIndex = Suffix - 1;
    return CurrentWeek - Mod(CurrentIndex - TargetIndex, TRIAL_ROTATION_LENGTH);
}

export function TrialsWindow(At: Date = new Date()){
    const Epoch = TrialEpoch();
    const Week = TrialWeekAt(At);
    const Start = Epoch + Week * TRIAL_WEEK_MS;
    const End = Start + TRIAL_WEEK_MS;

    return {
        trial_start: Math.floor(Start / 1000),
        trial_end: Math.floor(End / 1000),
        time_to_refresh: Math.max(0, Math.ceil((End - At.getTime()) / 1000))
    };
}

function ProfileText(Value: unknown, Name: string, Required = false){
    if(typeof Value !== "string" || Value.length > 128 || (Required && Value.length === 0)){
        throw new TrialsError(400, `${Name} is invalid`);
    }

    return Value;
}

// The 1.4.4 client reports its public leaderboard identity at login. Do not rewrite the
// private-server account name when the player changes a platform display name.
export function UpdateLeaderboardProfile(AccountId: string, Body: unknown){
    const Raw: any = Body;

    if(Raw == null || typeof Raw !== "object" || Array.isArray(Raw)){
        throw new TrialsError(400, "profile is invalid");
    }

    const DauntlessId = ProfileText(Raw.dauntlessid, "dauntlessid", true);

    if(DauntlessId !== AccountId){
        throw new TrialsError(403, "profile account does not match the authenticated account");
    }

    const EpicId = ProfileText(Raw.epicid ?? "", "epicid");
    const PlatformId = ProfileText(Raw.platformid ?? "", "platformid");
    const Platform = ProfileText(Raw.currentplatform ?? "", "currentplatform");
    const DisplayName = ProfileText(Raw.currentdisplayname, "currentdisplayname", true);
    const UpdatedDate = new Date().toISOString();

    GetDb().insert(leaderboardprofiles).values({
        accountId: AccountId,
        epicId: EpicId,
        platformId: PlatformId,
        platform: Platform,
        displayName: DisplayName,
        updatedDate: UpdatedDate
    }).onConflictDoUpdate({
        target: leaderboardprofiles.accountId,
        set: {epicId: EpicId, platformId: PlatformId, platform: Platform, displayName: DisplayName, updatedDate: UpdatedDate}
    }).run();
}

function Integer(Value: unknown, Name: string, Min: number, Max: number){
    const Parsed = typeof Value === "string" && /^\d+$/.test(Value) ? Number(Value) : Value;

    if(!Number.isSafeInteger(Parsed) || (Parsed as number) < Min || (Parsed as number) > Max){
        throw new TrialsError(400, `${Name} is invalid`);
    }

    return Parsed as number;
}

function TrialId(Body: any){
    if(typeof Body?.trial_id !== "string" || !TrialIdPattern.test(Body.trial_id)){
        throw new TrialsError(400, "trial_id is invalid");
    }

    return Body.trial_id;
}

function Difficulty(Body: any){
    return Integer(Body?.difficulty, "difficulty", 0, 1);
}

function Player(Raw: any): TrialPlayer {
    if(Raw == null || typeof Raw !== "object" || typeof Raw.phx_account_id !== "string" || Raw.phx_account_id.length === 0){
        throw new TrialsError(400, "trial player is missing phx_account_id");
    }

    const Text = (Value: unknown) => typeof Value === "string" ? Value.slice(0, 128) : "";

    return {
        phx_account_id: Raw.phx_account_id,
        platform: Text(Raw.platform),
        platform_name: Text(Raw.platform_name),
        player_role_id: Text(Raw.player_role_id),
        weapon: Integer(Raw.weapon ?? 0, "weapon", 0, 255),
        ...(Raw.secondary_weapon === undefined ? {} : {secondary_weapon: Integer(Raw.secondary_weapon, "secondary_weapon", 0, 255)})
    };
}

function SubmissionPlayers(Body: any): TrialPlayer[]{
    if(Array.isArray(Body?.entries)){
        if(Body.entries.length < 1 || Body.entries.length > 4){
            throw new TrialsError(400, "entries must contain one to four players");
        }

        return Body.entries.map((Entry: unknown) => Player(Entry));
    }

    return [Player(Body)];
}

function RunKey(Body: any, Players: TrialPlayer[], CompletionTime: number, ObjectivesCompleted: number){
    if(typeof Body?.session_id === "string" && Body.session_id.length > 0){
        return Body.session_id.slice(0, 256);
    }

    return crypto.createHash("sha256").update(JSON.stringify([
        Body.trial_id,
        Body.difficulty,
        CompletionTime,
        ObjectivesCompleted,
        Players
    ])).digest("hex");
}

function ParseEntries(Run: StoredTrialRun): TrialPlayer[] {
    return (JSON.parse(Run.entries) as TrialPlayer[]).map((Entry) => {
        const Profile = GetDb().select().from(leaderboardprofiles).where(eq(leaderboardprofiles.accountId, Entry.phx_account_id)).get();

        if(Profile == undefined){
            return Entry;
        }

        return {
            ...Entry,
            platform: Profile.platform || Entry.platform,
            platform_name: Profile.displayName || Entry.platform_name
        };
    });
}

export function SaveTrialRun(Body: unknown, At: Date = new Date()){
    const Raw: any = Body;
    const trialId = TrialId(Raw);
    const difficulty = Difficulty(Raw);
    const trialWeek = TrialWeekAt(At);

    if(trialId !== TrialIdForWeek(difficulty, trialWeek)){
        throw new TrialsError(409, "trial_id is not the active Trial");
    }
    const completionTime = Integer(Raw?.completion_time, "completion_time", 0, 24 * 60 * 60 * 1000);
    const objectivesCompleted = Integer(Raw?.objectives_completed ?? 0, "objectives_completed", 0, 99);
    const Players = SubmissionPlayers(Raw);
    const Mode: TrialMode = Players.length === 1 ? "solo" : "group";
    const AccountIds = Players.map((Entry) => Entry.phx_account_id);

    if(new Set(AccountIds).size !== AccountIds.length){
        throw new TrialsError(400, "the same player appears more than once");
    }

    const runKey = RunKey(Raw, Players, completionTime, objectivesCompleted);
    const groupKey = [...AccountIds].sort().join(":");
    const sessionId = typeof Raw?.session_id === "string" ? Raw.session_id.slice(0, 256) : runKey;
    const submittedDate = new Date().toISOString();

    GetDb().insert(trialruns).values({
        trialId,
        trialWeek,
        difficulty,
        mode: Mode,
        runKey,
        groupKey,
        completionTime,
        objectivesCompleted,
        sessionId,
        entries: JSON.stringify(Players),
        submittedDate
    }).onConflictDoNothing().run();

    return {trialId, trialWeek, difficulty, mode: Mode, accountIds: AccountIds};
}

type Query = {
    TrialId: string,
    TrialWeek: number,
    Difficulty: number,
    Page: number,
    PageSize: number,
    Platforms: Set<string>
};

function QueryFrom(Body: any, At: Date = new Date()): Query {
    const Platforms = new Set<string>();

    if(Body?.target_platforms !== undefined){
        if(!Array.isArray(Body.target_platforms) || Body.target_platforms.some((Value: unknown) => typeof Value !== "string")){
            throw new TrialsError(400, "target_platforms is invalid");
        }

        for(const Platform of Body.target_platforms) Platforms.add(Platform);
    }

    const Id = TrialId(Body);
    const DifficultyValue = Difficulty(Body);

    return {
        TrialId: Id,
        TrialWeek: TrialWeekForId(Id, DifficultyValue, At),
        Difficulty: DifficultyValue,
        Page: Integer(Body?.page ?? 0, "page", 0, 1000000),
        PageSize: Integer(Body?.page_size ?? 100, "page_size", 1, 100),
        Platforms
    };
}

function BestRuns(Rows: StoredTrialRun[]){
    const Best = new Map<string, StoredTrialRun>();

    for(const Run of Rows){
        const Current = Best.get(Run.groupKey);

        if(Current === undefined || Run.completionTime < Current.completionTime ||
            (Run.completionTime === Current.completionTime && Run.submittedDate < Current.submittedDate)){
            Best.set(Run.groupKey, Run);
        }
    }

    return [...Best.values()].sort((A, B) =>
        A.completionTime - B.completionTime ||
        B.objectivesCompleted - A.objectivesCompleted ||
        A.submittedDate.localeCompare(B.submittedDate) ||
        A.groupKey.localeCompare(B.groupKey)
    );
}

function Runs(Query: Query, Mode: TrialMode){
    const Rows = GetDb().select().from(trialruns).where(and(
        eq(trialruns.trialId, Query.TrialId),
        eq(trialruns.trialWeek, Query.TrialWeek),
        eq(trialruns.difficulty, Query.Difficulty),
        eq(trialruns.mode, Mode)
    )).all() as StoredTrialRun[];

    const Filtered = Rows.filter((Run) => {
        if(Query.Platforms.size === 0) return true;
        const Entries = ParseEntries(Run);
        return Entries.every((Entry) => Query.Platforms.has(Entry.platform));
    });

    return BestRuns(Filtered);
}

// Champion gear was a permanent unlock earned by finishing a Dauntless Trial in the
// Top 100 at the weekly reset. Finalize every completed week that has recorded runs.
// This is lazy and idempotent: the first leaderboard/Lady Luck request after rollover
// performs the grant, then trialweeks prevents it from running again.
export function FinalizeCompletedTrialWeeks(At: Date = new Date()){
    const CurrentWeek = TrialWeekAt(At);

    return GetDb().transaction((tx) => {
        const Finalized = new Set(tx.select({week: trialweeks.week}).from(trialweeks).all().map((Row) => Row.week));
        const OldRows = tx.select().from(trialruns).where(lt(trialruns.trialWeek, CurrentWeek)).all() as StoredTrialRun[];
        const Weeks = [...new Set(OldRows.map((Run) => Run.trialWeek))].filter((Week) => !Finalized.has(Week)).sort((A, B) => A - B);
        let AwardedAccounts = 0;

        for(const Week of Weeks){
            const Winners = new Set<string>();
            const Dauntless = OldRows.filter((Run) => Run.trialWeek === Week && Run.difficulty === 1);

            for(const Mode of ["solo", "group"] as const){
                for(const Run of BestRuns(Dauntless.filter((Entry) => Entry.mode === Mode)).slice(0, 100)){
                    for(const PlayerEntry of JSON.parse(Run.entries) as TrialPlayer[]){
                        Winners.add(PlayerEntry.phx_account_id);
                    }
                }
            }

            for(const AccountId of Winners){
                GrantEntitlementInTx(tx, AccountId, TRIALS_CHAMPION_ENTITLEMENT, 0, `trials:week:${Week}`);
            }

            tx.insert(trialweeks).values({
                week: Week,
                finalizedDate: At.toISOString(),
                awardedAccounts: Winners.size
            }).run();

            AwardedAccounts += Winners.size;
        }

        return {FinalizedWeeks: Weeks.length, AwardedAccounts};
    });
}

function SoloEntry(Run: StoredTrialRun, Rank: number){
    const Entry = ParseEntries(Run)[0];

    return {
        completion_time: Run.completionTime,
        objectives_completed: Run.objectivesCompleted,
        ...Entry,
        rank: Rank,
        session_id: Run.sessionId
    };
}

function GroupEntry(Run: StoredTrialRun, Rank: number){
    return {
        completion_time: Run.completionTime,
        entries: ParseEntries(Run),
        objectives_completed: Run.objectivesCompleted,
        rank: Rank,
        session_id: Run.sessionId
    };
}

function Page<T>(Rows: T[], Query: Query){
    return Rows.slice(Query.Page * Query.PageSize, Query.Page * Query.PageSize + Query.PageSize);
}

export function SoloLeaderboard(Body: unknown){
    const Query = QueryFrom(Body);
    const Entries = Runs(Query, "solo").map((Run, Index) => SoloEntry(Run, Index + 1));

    return {
        code: null,
        message: "OK",
        payload: {
            difficulty: Query.Difficulty,
            entries: Page(Entries, Query),
            page: Query.Page,
            page_size: Query.PageSize,
            trial_id: Query.TrialId,
            ...TrialsWindow()
        }
    };
}

export function GroupLeaderboard(Body: unknown){
    const Query = QueryFrom(Body);
    const Entries = Runs(Query, "group").map((Run, Index) => GroupEntry(Run, Index + 1));

    return {
        code: null,
        message: "OK",
        payload: {
            difficulty: Query.Difficulty,
            entries: Page(Entries, Query),
            page: Query.Page,
            page_size: Query.PageSize,
            trial_id: Query.TrialId,
            ...TrialsWindow()
        }
    };
}

export function AllLeaderboards(Body: unknown){
    const Query = QueryFrom(Body);
    const Solo = Runs(Query, "solo").map((Run, Index) => SoloEntry(Run, Index + 1));
    const Group = Runs(Query, "group").map((Run, Index) => GroupEntry(Run, Index + 1));

    return {
        code: null,
        message: "OK",
        payload: {
            difficulty: Query.Difficulty,
            guild: {},
            page: Query.Page,
            page_size: Query.PageSize,
            trial_id: Query.TrialId,
            ...TrialsWindow(),
            world: {
                group: {
                    difficulty: Query.Difficulty,
                    entries: Page(Group, Query)
                },
                solo: {
                    all: {
                        difficulty: Query.Difficulty,
                        entries: Page(Solo, Query)
                    }
                }
            }
        }
    };
}

function AccountId(Body: any){
    if(typeof Body?.phx_account_id !== "string" || Body.phx_account_id.length === 0){
        throw new TrialsError(400, "phx_account_id is invalid");
    }

    return Body.phx_account_id;
}

export function SoloIndividual(Body: unknown){
    const Raw: any = Body;
    const Query = QueryFrom({...Raw, page: 0, page_size: 100});
    const Account = AccountId(Raw);
    const RunsAll = Runs(Query, "solo");
    const Index = RunsAll.findIndex((Run) => Run.groupKey === Account);

    if(Index < 0){
        return {code: null, message: "OK", payload: {}};
    }

    return {
        code: null,
        message: "OK",
        payload: {
            ...SoloEntry(RunsAll[Index], Index + 1),
            difficulty: String(Query.Difficulty),
            trial_id: Query.TrialId
        }
    };
}

export function GroupIndividual(Body: unknown){
    const Raw: any = Body;
    const Query = QueryFrom({...Raw, page: 0, page_size: 100});
    const Account = AccountId(Raw);
    const RunsAll = Runs(Query, "group");
    const Index = RunsAll.findIndex((Run) => ParseEntries(Run).some((Entry) => Entry.phx_account_id === Account));

    if(Index < 0){
        return {code: null, message: "OK", payload: {}};
    }

    return {
        code: null,
        message: "OK",
        payload: {
            ...GroupEntry(RunsAll[Index], Index + 1),
            difficulty: String(Query.Difficulty),
            trial_id: Query.TrialId
        }
    };
}
