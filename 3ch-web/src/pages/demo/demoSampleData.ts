export const DEMO_PEOPLE = [
  { id: "demo-person-1", name: "김민준", division: "1부" },
  { id: "demo-person-2", name: "이서준", division: "2부" },
  { id: "demo-person-3", name: "박도윤", division: "3부" },
  { id: "demo-person-4", name: "최현우", division: "4부" },
  { id: "demo-person-5", name: "정우진", division: "5부" },
  { id: "demo-person-6", name: "한지훈", division: "6부" },
  { id: "demo-person-7", name: "오승민", division: "7부" },
  { id: "demo-person-8", name: "윤태호", division: "8부" },
] as const;

export const DEMO_CLUB_EXTRA_PEOPLE = [
  { id: "demo-person-9", name: "장우석", division: "9부" },
  { id: "demo-person-10", name: "임재현", division: "10부" },
] as const;

export const DEMO_CLUB_MEMBERS = [...DEMO_PEOPLE, ...DEMO_CLUB_EXTRA_PEOPLE];

export const DEMO_RANKINGS = [
  { personId: "demo-person-1", rank: 1, matches: 18, wins: 15, losses: 3, rating: 1560 },
  { personId: "demo-person-3", rank: 2, matches: 16, wins: 12, losses: 4, rating: 1510 },
  { personId: "demo-person-2", rank: 3, matches: 17, wins: 12, losses: 5, rating: 1485 },
  { personId: "demo-person-5", rank: 4, matches: 16, wins: 10, losses: 6, rating: 1430 },
  { personId: "demo-person-4", rank: 5, matches: 15, wins: 9, losses: 6, rating: 1405 },
  { personId: "demo-person-7", rank: 6, matches: 15, wins: 8, losses: 7, rating: 1370 },
  { personId: "demo-person-6", rank: 7, matches: 14, wins: 7, losses: 7, rating: 1340 },
  { personId: "demo-person-8", rank: 8, matches: 13, wins: 5, losses: 8, rating: 1285 },
  { personId: "demo-person-10", rank: 9, matches: 13, wins: 4, losses: 9, rating: 1240 },
  { personId: "demo-person-9", rank: 10, matches: 12, wins: 3, losses: 9, rating: 1200 },
] as const;

export const DEMO_LEAGUE = {
  id: "demo-league",
  name: "우리리그 리그",
  date: "2026년 1월 1일",
  time: "09:00~18:00",
  location: "탁구클럽",
  courtCount: 4,
  participantCount: DEMO_PEOPLE.length,
} as const;

export const DEMO_RECOMMENDED_PROGRAM = [
  { round: "1라운드", program: "단식", format: "단일리그", detail: "8명 풀리그 · 5전 3선승제" },
] as const;

export const DEMO_CUSTOM_PROGRAM = [
  { round: "1라운드", program: "단식", format: "단일리그", detail: "8명 풀리그 · 3전 2선승제" },
  { round: "2라운드", program: "복식", format: "조별리그", detail: "2인 1조 · 2개 조 · 3전 2선승제" },
  { round: "3라운드", program: "단체전", format: "토너먼트", detail: "4인 1팀 · 단식 3경기와 복식 1경기" },
] as const;

export const DEMO_MATCHES = [
  { order: 1, court: "1번 코트", left: "김민준", right: "윤태호", score: "3 : 0", status: "완료" },
  { order: 2, court: "2번 코트", left: "이서준", right: "오승민", score: "3 : 1", status: "완료" },
  { order: 3, court: "3번 코트", left: "박도윤", right: "한지훈", score: "3 : 2", status: "완료" },
  { order: 4, court: "4번 코트", left: "최현우", right: "정우진", score: "2 : 3", status: "완료" },
  { order: 5, court: "1번 코트", left: "김민준", right: "오승민", score: "3 : 1", status: "완료" },
  { order: 6, court: "2번 코트", left: "이서준", right: "윤태호", score: "3 : 0", status: "완료" },
] as const;

export const DEMO_BRACKET = [
  { label: "준결승 1", left: "김민준", right: "박도윤", score: "3 : 1", winner: "김민준" },
  { label: "준결승 2", left: "이서준", right: "정우진", score: "2 : 3", winner: "정우진" },
  { label: "결승", left: "김민준", right: "정우진", score: "3 : 2", winner: "김민준" },
] as const;

export const DEMO_PRIZES = [
  { id: "racket", name: "라켓", quantity: 1 },
  { id: "uniform", name: "유니폼", quantity: 1 },
  { id: "socks", name: "양말", quantity: 4 },
] as const;
