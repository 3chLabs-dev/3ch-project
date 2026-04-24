import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import axios from "axios";
import { baseApi } from "../api/baseApi";

/** Step 1: 기본 정보 */
export interface LeagueBasicInfo {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  title: string;
}

/** Step 2: 리그 유형 */
export type LeagueTypeValue =
  | "singles"
  | "doubles"
  | "team"
  | "club_battle"
  | "club_exchange";

export interface LeagueTypeInfo {
  selectedType: LeagueTypeValue;
}

/** Step 3: 리그 방식 */
export type LeagueFormatValue =
  | "single-league"
  | "group-league"
  | "group-and-knockout"
  | "single-league-tournament"
  | "group-league-tournament"
  | "upper-lower-tournament";

export interface LeagueFormatInfo {
  format: LeagueFormatValue;
}

/** Step 4: 리그 규칙 */
export type LeagueRuleValue =
  | "best-of-3"
  | "best-of-5"
  | "best-of-7"
  | "3-sets";

export interface LeagueRulesInfo {
  rule: LeagueRuleValue;
}

/** Step 4-5: 토너먼트 옵션 (상·하위 토너먼트 전용) */
export type TournamentSeedingValue = "manual" | "seed" | "random" | "group";
export type TournamentAdvancementValue = "upper-only" | "upper-lower";

export interface LeagueTournamentOptionsInfo {
  seeding: TournamentSeedingValue;
  advancement: TournamentAdvancementValue;
}

/** Step 4b: 본선 편성 설정 (단일리그+토너먼트 전용) */
export type AdvanceMethodValue = "rank" | "top1" | "top2" | "upper-lower";
export interface LeagueMainSetupInfo {
  tournament_rules: string;
  advance_count: number;
  advance_method: AdvanceMethodValue;
  seeding: "seed" | "random" | "standings";
  finals_advance: number;
}

/** Step 5: 참가자 */
export interface Participant {
  division: string;
  name: string;
  member_id?: number | null;
  paid: boolean;
  arrived: boolean;
  after: boolean;
}

export interface LeagueParticipantsInfo {
  recruitCount: number | null;
  sortOrder: string | null;
  participants: Participant[];
}

/** Step 6: 일정 */
export interface GameEntry {
  date: string;
  time: string;
  location: string;
}

export interface LeagueStep6CreatingInfo {
  gameEntries: GameEntry[];
}

/** 생성 상태 */
export type CreateStatus = "idle" | "loading" | "succeeded" | "failed";

/** 전체 상태 */
export interface LeagueCreationState {
  currentStep: number;
  groupId: string | null;
  preferredGroupId: string | null;

  step1BasicInfo: LeagueBasicInfo | null;
  step2Type: LeagueTypeInfo | null;
  step3Format: LeagueFormatInfo | null;
  step4Rules: LeagueRulesInfo | null;
  step4TournamentOptions: LeagueTournamentOptionsInfo | null;
  step4MainSetup: LeagueMainSetupInfo | null;
  step5Participants: LeagueParticipantsInfo | null;
  step6Creating: LeagueStep6CreatingInfo | null;

  createStatus: CreateStatus;
  createError: string | null;
  createdLeagueId: string | null;
}

const initialState: LeagueCreationState = {
  currentStep: 1,
  groupId: null,
  preferredGroupId: null,

  step1BasicInfo: null,
  step2Type: null,
  step3Format: null,
  step4Rules: null,
  step4TournamentOptions: null,
  step4MainSetup: null,
  step5Participants: null,
  step6Creating: null,

  createStatus: "idle",
  createError: null,
  createdLeagueId: null,
};

export const createLeague = createAsyncThunk.withTypes<{ state: RootState }>()(
  "leagueCreation/createLeague",
  async (_arg, thunkApi) => {
    const s = thunkApi.getState().leagueCreation;

    // 필수 데이터 검증
    if (!s.groupId) {
      throw new Error("클럽이 선택되지 않았습니다.");
    }
    if (!s.step1BasicInfo) {
      throw new Error("기본 정보가 입력되지 않았습니다.");
    }
    if (!s.step2Type) {
      throw new Error("리그 타입이 선택되지 않았습니다.");
    }

    // 리그 타입 매핑 (API에 전송할 형식으로 변환)
    const typeMap: Record<LeagueTypeValue, string> = {
      singles: "단식",
      doubles: "복식",
      team: "단체전",
      club_battle: "클럽 대항전",
      club_exchange: "클럽 교류전",
    };

    // 리그 규칙 매핑
    const rulesMap: Record<LeagueRuleValue, string> = {
      "best-of-3": "3전 2선승제",
      "best-of-5": "5전 3선승제",
      "best-of-7": "7전 4선승제",
      "3-sets": "3세트제",
    };

    // 리그 방식 매핑
    const formatMap: Record<LeagueFormatValue, string> = {
      "single-league": "단일리그",
      "group-league": "조별리그",
      "group-and-knockout": "조별리그 + 본선리그",
      "single-league-tournament": "단일리그 + 토너먼트",
      "group-league-tournament": "조별리그 + 토너먼트",
      "upper-lower-tournament": "상·하위 토너먼트",
    };

    // ISO 8601 날짜 문자열 생성
    const startDateTime = `${s.step1BasicInfo.date}T${s.step1BasicInfo.time}:00`;
    const start_date = new Date(startDateTime).toISOString();

    // 리그명 자동 생성: "날짜 + 타입" 형식
    const autoName = `${s.step1BasicInfo.date} ${typeMap[s.step2Type.selectedType]} 리그`;

    const recruitCount = s.step5Participants?.recruitCount ?? 0;
    const participantCount = s.step5Participants?.participants.length ?? 0;
    const participants = (s.step5Participants?.participants ?? []).map((p) => ({
      division: p.division,
      name: p.name,
      member_id: p.member_id ?? null,
      paid: p.paid,
      arrived: p.arrived,
      after: p.after,
    }));

    const requestBody = {
      name: autoName,
      description: s.step1BasicInfo.location ? `장소: ${s.step1BasicInfo.location}` : undefined,
      title: s.step1BasicInfo.title ? `${s.step1BasicInfo.title}` : undefined,
      type: typeMap[s.step2Type.selectedType],
      format: s.step3Format ? formatMap[s.step3Format.format] : undefined,
      sport: "탁구", // 탁구로 고정 (향후 확장 예정)
      start_date,
      rules: s.step4Rules ? rulesMap[s.step4Rules.rule] : undefined,
      recruit_count: recruitCount,
      participant_count: participantCount,
      group_id: s.groupId,
      sort_order: s.step5Participants?.sortOrder ?? undefined,
      participants,
      tournament_seeding: s.step4TournamentOptions?.seeding ?? s.step4MainSetup?.seeding ?? undefined,
      tournament_advancement: s.step4TournamentOptions?.advancement ?? undefined,
      tournament_rules: s.step4MainSetup?.tournament_rules
        ? (rulesMap as Record<string, string>)[s.step4MainSetup.tournament_rules] ?? s.step4MainSetup.tournament_rules
        : undefined,
      advance_count: s.step4MainSetup?.advance_count ?? undefined,
      advance_method: s.step4MainSetup?.advance_method ?? undefined,
      finals_advance: s.step4MainSetup?.finals_advance ?? undefined,
    };

    const token = thunkApi.getState().auth.token;
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/league`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    thunkApi.dispatch(
      baseApi.util.invalidateTags([{ type: "League", id: "LIST" }])
    );

    return { leagueId: response.data.league.id };
  }
);

const leagueCreationSlice = createSlice({
  name: "leagueCreation",
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },

    setGroupId: (state, action: PayloadAction<string>) => {
      state.groupId = action.payload;
    },

    setPreferredGroupId: (state, action: PayloadAction<string | null>) => {
      state.preferredGroupId = action.payload;
    },

    setStep1BasicInfo: (state, action: PayloadAction<LeagueBasicInfo>) => {
      state.step1BasicInfo = action.payload;
    },

    setStep2Type: (state, action: PayloadAction<LeagueTypeInfo>) => {
      state.step2Type = action.payload;
    },

    setStep3Format: (state, action: PayloadAction<LeagueFormatInfo>) => {
      state.step3Format = action.payload;
    },

    setStep4Rules: (state, action: PayloadAction<LeagueRulesInfo>) => {
      state.step4Rules = action.payload;
    },

    setStep4TournamentOptions: (state, action: PayloadAction<LeagueTournamentOptionsInfo>) => {
      state.step4TournamentOptions = action.payload;
    },

    setStep4MainSetup: (state, action: PayloadAction<LeagueMainSetupInfo>) => {
      state.step4MainSetup = action.payload;
    },

    setStep5Participants: (
      state,
      action: PayloadAction<LeagueParticipantsInfo>,
    ) => {
      state.step5Participants = action.payload;
    },

    setStep6Creating: (state, action: PayloadAction<LeagueStep6CreatingInfo>) => {
      state.step6Creating = action.payload;
    },

    resetCreateStatus: (state) => {
      state.createStatus = "idle";
      state.createError = null;
      state.createdLeagueId = null;
    },

    resetLeagueCreation: (state) => {
      const preferredGroupId = state.preferredGroupId;
      Object.assign(state, initialState);
      state.preferredGroupId = preferredGroupId;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(createLeague.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
        state.createdLeagueId = null;
      })
      .addCase(createLeague.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        state.createdLeagueId = action.payload.leagueId;
      })
      .addCase(createLeague.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.error.message ?? "리그 생성 실패";
      });
  },
});

export const {
  setStep,
  setGroupId,
  setPreferredGroupId,
  setStep1BasicInfo,
  setStep2Type,
  setStep3Format,
  setStep4Rules,
  setStep4TournamentOptions,
  setStep4MainSetup,
  setStep5Participants,
  setStep6Creating,
  resetCreateStatus,
  resetLeagueCreation,
} = leagueCreationSlice.actions;

export default leagueCreationSlice.reducer;
