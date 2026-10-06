import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { GetDb } from "../db";
import { leaderboardprofiles, trialruns } from "../db/schema";

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
const TRIAL_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function TrialsWindow(At: Date = new Date()){
    const Epoch = Date.parse(process.env.TRIAL_ROTATION_START ?? TRIAL_ROTATION_START);

    if(Number.isNaN(Epoch)){
        throw new TrialsError(500, "TRIAL_ROTATION_START is invalid");
    }

    const Week = Math.floor((At.getTime() - Epoch) / TRIAL_WEEK_MS);
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

export function SaveTrialRun(Body: unknown){
    const Raw: any = Body;
    const trialId = TrialId(Raw);
    const difficulty = Difficulty(Raw);
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

    return {trialId, difficulty, mode: Mode, accountIds: AccountIds};
}

type Query = {
    TrialId: string,
    Difficulty: number,
    Page: number,
    PageSize: number,
    Platforms: Set<string>
};

function QueryFrom(Body: any): Query {
    const Platforms = new Set<string>();

    if(Body?.target_platforms !== undefined){
        if(!Array.isArray(Body.target_platforms) || Body.target_platforms.some((Value: unknown) => typeof Value !== "string")){
            throw new TrialsError(400, "target_platforms is invalid");
        }

        for(const Platform of Body.target_platforms) Platforms.add(Platform);
    }

    return {
        TrialId: TrialId(Body),
        Difficulty: Difficulty(Body),
        Page: Integer(Body?.page ?? 0, "page", 0, 1000000),
        PageSize: Integer(Body?.page_size ?? 100, "page_size", 1, 100),
        Platforms
    };
}

function Runs(Query: Query, Mode: TrialMode){
    const Rows = GetDb().select().from(trialruns).where(and(
        eq(trialruns.trialId, Query.TrialId),
        eq(trialruns.difficulty, Query.Difficulty),
        eq(trialruns.mode, Mode)
    )).all() as StoredTrialRun[];

    const Filtered = Rows.filter((Run) => {
        if(Query.Platforms.size === 0) return true;
        const Entries = ParseEntries(Run);
        return Entries.every((Entry) => Query.Platforms.has(Entry.platform));
    });

    const Best = new Map<string, StoredTrialRun>();

    for(const Run of Filtered){
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
