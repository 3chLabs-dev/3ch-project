import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

/** Step 1: 기본 정보 */
export interface LeagueBasicInfo {
  name: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
}

/** Step 2: 리그 유형 */
export type LeagueTypeValue =
  | "singles"
  | "doubles"
  | "2-person-team"
  | "3-person-team"
  | "4-person-team";

export interface LeagueTypeInfo {
  selectedType: LeagueTypeValue;
}

/** Step 3: 리그 방식 */
export type LeagueFormatValue =
  | "single-league"
  | "group-league"
  | "group-and-knockout";

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

/** Step 5: 참가자 */
export interface Participant {
  division: string;
  name: string;
  paid: boolean;
  arrived: boolean;
  footPool: boolean;
}

export interface LeagueParticipantsInfo {
  recruitCount: number | null;
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

  step1BasicInfo: LeagueBasicInfo | null;
  step2Type: LeagueTypeInfo | null;
  step3Format: LeagueFormatInfo | null;
  step4Rules: LeagueRulesInfo | null;
  step5Participants: LeagueParticipantsInfo | null;
  step6Creating: LeagueStep6CreatingInfo | null;

  createStatus: CreateStatus;
  createError: string | null;
  createdLeagueId: string | null;
}

const initialState: LeagueCreationState = {
  currentStep: 1,

  step1BasicInfo: null,
  step2Type: null,
  step3Format: null,
  step4Rules: null,
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

    const payload = {
      step1: s.step1BasicInfo,
      step2: s.step2Type,
      step3: s.step3Format,
      step4: s.step4Rules,
      step5: s.step5Participants,
      step6: s.step6Creating,
    };

    // eslint/ts “unused” 방지 + 나중에 axios 등으로 API 연결 시 사용
    void payload;

    await new Promise((r) => setTimeout(r, 1200));
    return { leagueId: `L-${Date.now()}` };
  }
);

const leagueCreationSlice = createSlice({
  name: "leagueCreation",
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
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

    resetLeagueCreation: () => initialState,
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
  setStep1BasicInfo,
  setStep2Type,
  setStep3Format,
  setStep4Rules,
  setStep5Participants,
  setStep6Creating,
  resetCreateStatus,
  resetLeagueCreation,
} = leagueCreationSlice.actions;

export default leagueCreationSlice.reducer;
