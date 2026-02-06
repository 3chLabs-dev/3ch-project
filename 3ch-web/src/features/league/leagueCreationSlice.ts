import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

/** Step 1: 기본 정보 */
export interface LeagueBasicInfo {
  name: string;
  description: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
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
export interface LeagueParticipantsInfo {
  participants: string[];
}

/** Step 6: 일정 */
export interface GameEntry {
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  location: string; // 선택이어도 string으로 통일(빈문자열 허용)
}

export interface LeagueScheduleInfo {
  gameEntries: GameEntry[];
}

/** 전체 상태 */
export interface LeagueCreationState {
  currentStep: number; // 1~7

  step1BasicInfo: LeagueBasicInfo | null;
  step2Type: LeagueTypeInfo | null;
  step3Format: LeagueFormatInfo | null;
  step4Rules: LeagueRulesInfo | null;
  step5Participants: LeagueParticipantsInfo | null;
  step6Schedule: LeagueScheduleInfo | null;
}

const initialState: LeagueCreationState = {
  currentStep: 1,

  step1BasicInfo: null,
  step2Type: null,
  step3Format: null,
  step4Rules: null,
  step5Participants: null,
  step6Schedule: null,
};

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

    setStep5Participants: (state, action: PayloadAction<LeagueParticipantsInfo>) => {
      state.step5Participants = action.payload;
    },

    setStep6Schedule: (state, action: PayloadAction<LeagueScheduleInfo>) => {
      state.step6Schedule = action.payload;
    },

    resetLeagueCreation: () => initialState,
  },
});

export const {
  setStep,
  setStep1BasicInfo,
  setStep2Type,
  setStep3Format,
  setStep4Rules,
  setStep5Participants,
  setStep6Schedule,
  resetLeagueCreation,
} = leagueCreationSlice.actions;

export default leagueCreationSlice.reducer;
