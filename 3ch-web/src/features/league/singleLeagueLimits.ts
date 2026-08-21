export const SINGLE_ROUND_SINGLES_LEAGUE_MAX_PARTICIPANTS = 20;

type ProgramShape = {
  rounds?: Array<{ program?: string | null; format?: string | null }>;
  blocks?: Array<{ type?: string | null; format?: string | null }>;
};

export function isSingleRoundSinglesLeagueProgram(program?: ProgramShape | null) {
  const rounds = program?.rounds ?? [];
  if (rounds.length > 0) {
    return rounds.length === 1 && rounds[0]?.program === "SINGLES" && rounds[0]?.format === "LEAGUE";
  }
  const blocks = program?.blocks ?? [];
  return blocks.length === 1 && blocks[0]?.type === "SINGLES" && blocks[0]?.format === "LEAGUE";
}

export function getSingleLeagueParticipantLimitMessage(participantCount?: number) {
  const countPrefix = participantCount == null ? "" : `현재 참가자가 ${participantCount}명입니다. `;
  return `${countPrefix}1라운드 단식 단일리그는 최대 ${SINGLE_ROUND_SINGLES_LEAGUE_MAX_PARTICIPANTS}명까지 운영할 수 있습니다. 참가자를 줄이거나 경기 방식을 변경해 주세요.`;
}
