import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { RootState } from "../../app/store";
import type { Participant, LeagueTypeValue, LeagueFormatValue, LeagueRuleValue } from "./leagueCreationSlice";
import type { ProgramOption, RoundConfig } from "./types/tournament.types";
import { isLocalDevToken } from "../../utils/localDevAuth";
import { createLocalDevLeague, saveLocalDevProgram } from "../../utils/localDevLeagueStore";
import { generateProgramBlocks } from "./algorithms/generateProgramBlocks";
import { generateGroupOptions } from "./algorithms/generateGroupOptions";

export interface RenewalLeagueBasicInfo {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  participantCount: number | null;
  courtCount: number | null;
}

export interface RenewalLeagueConfiguration {
  type: LeagueTypeValue | null;
  format: LeagueFormatValue | null;
  rule: LeagueRuleValue | null;
  teamPlayerCount: number;
}

export interface RenewalRoundConfig
  extends Omit<
    RoundConfig,
    "program" | "format" | "option" | "matchRule" | "teamPlayerCount" | "teamMatchType"
  > {
  program: RoundConfig["program"] | null;
  format: RoundConfig["format"] | null;
  option: RoundConfig["option"] | null;
  matchRule: RoundConfig["matchRule"] | null;
  teamPlayerCount: number | null;
  teamMatchType: RoundConfig["teamMatchType"] | null;
}

export interface RenewalLeagueCreationState {
  currentStep: number;
  groupId: string | null;
  basicInfo: RenewalLeagueBasicInfo | null;
  configuration: RenewalLeagueConfiguration;
  compositionMode: "recommend" | "custom" | null;
  selectedProgram: ProgramOption | null;
  rounds: RenewalRoundConfig[];
  participants: Participant[];
  invitedGroupIds: string[];
  invitedGroupOptions: Array<{ id: string; name: string }>;
  createStatus: "idle" | "loading" | "succeeded" | "failed";
  createError: string | null;
  createdLeagueId: string | null;
}

const initialState: RenewalLeagueCreationState = {
  currentStep: 1,
  groupId: null,
  basicInfo: null,
  configuration: {
    type: null,
    format: null,
    rule: null,
    teamPlayerCount: 4,
  },
  compositionMode: null,
  selectedProgram: null,
  rounds: [{ id: 1, expanded: true, program: null, format: null, option: null, matchRule: null, teamPlayerCount: null, teamMatchType: null, tournamentSeeding: "seed", tournamentBracketCount: 1 }],
  participants: [],
  invitedGroupIds: [],
  invitedGroupOptions: [],
  createStatus: "idle",
  createError: null,
  createdLeagueId: null,
};

const typeMap: Record<LeagueTypeValue, string> = {
  singles: "단식",
  doubles: "복식",
  team: "단체전",
  club_battle: "클럽 교류전",
  club_event: "클럽 이벤트",
};

const formatMap: Partial<Record<LeagueFormatValue, string>> = {
  "single-league": "단일리그",
  "group-league": "조별리그",
  "single-league-tournament": "단일리그 + 토너먼트",
  "upper-lower-tournament": "상·하위 토너먼트",
  "event-program": "이벤트 프로그램",
};

export const createRenewalLeague = createAsyncThunk.withTypes<{ state: RootState }>()(
  "leagueRenewalCreation/createLeague",
  async (_arg, thunkApi) => {
    const state = thunkApi.getState().leagueRenewalCreation;
    const rootState = thunkApi.getState();
    const token = rootState.auth.token;
    const resolvedGroupId = state.groupId ?? rootState.leagueCreation.groupId ?? rootState.leagueCreation.preferredGroupId;
    if (!state.basicInfo || !state.compositionMode) {
      throw new Error("리그 생성에 필요한 정보가 없습니다.");
    }
    if (!resolvedGroupId && !isLocalDevToken(token)) {
      throw new Error("리그를 생성할 클럽 정보가 없습니다. 리그 메인에서 클럽을 선택한 뒤 다시 시도해주세요.");
    }

    let programData = state.selectedProgram;
    if (state.compositionMode === "custom") {
      const hasIncompleteRound = state.rounds.some(
        (round) => !round.program || !round.format || !round.matchRule ||
          (round.program === "TEAM" && !round.teamPlayerCount),
      );
      if (hasIncompleteRound) throw new Error("모든 라운드의 유형, 방식, 규칙을 선택해주세요.");

      const configuredPlayerCount = state.basicInfo.participantCount ?? state.participants.length;
      const playerCount = Math.max(2, configuredPlayerCount);
      const courtCount = Math.max(1, state.basicInfo.courtCount ?? 1);
      const groupSizes = generateGroupOptions(playerCount)[0]?.groups ?? [playerCount];
      const rounds = state.rounds.map((round, roundIndex) => ({
        ...round,
        program: round.program!,
        format: round.format!,
        option: round.option ?? "NONE",
        matchRule: round.matchRule!,
        teamPlayerCount: round.teamPlayerCount ?? 4,
        teamMatchType: round.teamMatchType ?? "SSS",
        groupSizes: round.groupSizes ?? groupSizes,
        tournamentSeeding: round.tournamentSeeding ?? "seed",
        tournamentBracketCount:
          round.format === "TOURNAMENT" && round.option === "FINAL" &&
          roundIndex > 0 && state.rounds[roundIndex - 1]?.format === "GROUP" &&
          state.rounds[roundIndex - 1]?.option === "PRELIM"
            ? round.tournamentBracketCount ?? 1
            : 1,
      })) as RoundConfig[];
      let elapsedMinutes = 0;
      const blocks = generateProgramBlocks(
        {
          singlesEnabled: rounds.some((round) => round.program === "SINGLES"),
          doublesEnabled: rounds.some((round) => round.program === "DOUBLES"),
          teamEnabled: rounds.some((round) => round.program === "TEAM"),
          teamMatchRounds: [],
          programOrder: rounds.map((round) => round.program),
          teamPlayerCount: rounds.find((round) => round.program === "TEAM")?.teamPlayerCount ?? 4,
          rounds,
        },
        playerCount,
        courtCount,
        groupSizes,
      ).map((block) => {
        const startMinutes = elapsedMinutes;
        elapsedMinutes += block.expectedMinutes;
        return { ...block, startMinutes, endMinutes: elapsedMinutes };
      });
      const matchCount = blocks.reduce((sum, block) => sum + block.matchCount, 0);
      const expectedMinutes = blocks.reduce((sum, block) => sum + block.expectedMinutes, 0);
      programData = {
        title: "직접 구성 프로그램",
        groupSizes,
        matchRule: blocks[0]?.matchRule ?? "5전 3선승제",
        matchCount,
        expectedMinutes,
        recommendationScore: 0,
        description: "직접 구성한 이벤트 프로그램",
        blocks,
        totalBlockMatchCount: matchCount,
        totalProgramMinutes: expectedMinutes,
        isOverTime: false,
        rounds,
      };
    }
    if (!programData) throw new Error("이벤트 프로그램을 선택해주세요.");
    programData = {
      ...programData,
      compositionMode: state.compositionMode,
    } as ProgramOption & { compositionMode: "recommend" | "custom" };

    const requestBody = {
      name: state.basicInfo.title,
      title: state.basicInfo.title,
      description: state.basicInfo.location ? `장소: ${state.basicInfo.location}` : undefined,
      type: typeMap.club_event,
      format: formatMap["event-program"],
      sport: "탁구",
      start_date: new Date(`${state.basicInfo.date}T${state.basicInfo.startTime}:00`).toISOString(),
      end_date: state.basicInfo.endTime
        ? new Date(`${state.basicInfo.date}T${state.basicInfo.endTime}:00`).toISOString()
        : undefined,
      court_count: state.basicInfo.courtCount ?? undefined,
      rules: "프로그램별 설정",
      recruit_count: state.basicInfo.participantCount ?? 0,
      participant_count: state.participants.length,
      group_id: resolvedGroupId ?? undefined,
      sort_order: "부수",
      participants: state.participants,
      invited_group_ids: state.invitedGroupIds,
      tournament_seeding: "seed",
      program_data: programData,
    };

    if (isLocalDevToken(token)) {
      const league = createLocalDevLeague(requestBody);
      saveLocalDevProgram(league.id, programData);
      return { leagueId: league.id };
    }

    const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/league`, requestBody, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return { leagueId: response.data.league.id as string };
  },
);

const leagueRenewalCreationSlice = createSlice({
  name: "leagueRenewalCreation",
  initialState,
  reducers: {
    setRenewalStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    setRenewalGroupId: (state, action: PayloadAction<string>) => {
      state.groupId = action.payload;
    },
    setRenewalBasicInfo: (state, action: PayloadAction<RenewalLeagueBasicInfo>) => {
      state.basicInfo = action.payload;
    },
    setRenewalConfiguration: (state, action: PayloadAction<Partial<RenewalLeagueConfiguration>>) => {
      state.configuration = { ...state.configuration, ...action.payload };
    },
    setRenewalCompositionMode: (state, action: PayloadAction<"recommend" | "custom">) => {
      state.compositionMode = action.payload;
    },
    setRenewalSelectedProgram: (state, action: PayloadAction<ProgramOption | null>) => {
      state.selectedProgram = action.payload;
    },
    setRenewalRounds: (state, action: PayloadAction<RenewalRoundConfig[]>) => {
      state.rounds = action.payload;
    },
    setRenewalParticipants: (state, action: PayloadAction<Participant[]>) => {
      state.participants = action.payload;
    },
    setRenewalInvitedGroupIds: (state, action: PayloadAction<string[]>) => {
      state.invitedGroupIds = action.payload;
    },
    setRenewalInvitedGroupOptions: (state, action: PayloadAction<Array<{ id: string; name: string }>>) => {
      state.invitedGroupOptions = action.payload;
    },
    resetRenewalCreateStatus: (state) => {
      state.createStatus = "idle";
      state.createError = null;
    },
    resetRenewalLeagueCreation: (state) => {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRenewalLeague.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
      })
      .addCase(createRenewalLeague.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        state.createdLeagueId = action.payload.leagueId;
      })
      .addCase(createRenewalLeague.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.error.message ?? "리그 생성에 실패했습니다.";
      });
  },
});

export const {
  setRenewalStep,
  setRenewalGroupId,
  setRenewalBasicInfo,
  setRenewalConfiguration,
  setRenewalCompositionMode,
  setRenewalSelectedProgram,
  setRenewalRounds,
  setRenewalParticipants,
  setRenewalInvitedGroupIds,
  setRenewalInvitedGroupOptions,
  resetRenewalCreateStatus,
  resetRenewalLeagueCreation,
} = leagueRenewalCreationSlice.actions;

export default leagueRenewalCreationSlice.reducer;
