import type { Group } from "../features/group/groupApi";

export const LOCAL_DEV_EMAIL = "test@test.com";
export const LOCAL_DEV_PASSWORD = "testtest1!";
export const LOCAL_DEV_TOKEN = "local-dev-token";

export const LOCAL_DEV_USER = {
  id: 999001,
  email: LOCAL_DEV_EMAIL,
  name: "테스트",
  auth_provider: "local-dev",
};

export const LOCAL_DEV_GROUP: Group = {
  id: "local-dev-group",
  name: "테스트",
  club_code: "LOCALTEST",
  sport: "탁구",
  region_city: "서울특별시",
  region_district: "성동구",
  created_at: new Date(0).toISOString(),
  creator_name: LOCAL_DEV_USER.name,
  member_count: 1,
  role: "owner",
  division: null,
};

export const LOCAL_DEV_SECOND_EMAIL = "test2@test.com";
export const LOCAL_DEV_SECOND_PASSWORD = "testtest2@";
export const LOCAL_DEV_SECOND_TOKEN = "local-dev-token-2";

export const LOCAL_DEV_SECOND_USER = {
  id: 999002,
  email: LOCAL_DEV_SECOND_EMAIL,
  name: "테스트2",
  auth_provider: "local-dev",
};

export const LOCAL_DEV_SECOND_GROUP: Group = {
  id: "local-dev-group-2",
  name: "테스트2",
  club_code: "LOCALTEST2",
  sport: "탁구",
  region_city: "서울특별시",
  region_district: "강북구",
  created_at: new Date(0).toISOString(),
  creator_name: LOCAL_DEV_SECOND_USER.name,
  member_count: 1,
  role: "owner",
  division: null,
};

export const LOCAL_DEV_GROUPS = [LOCAL_DEV_GROUP, LOCAL_DEV_SECOND_GROUP];

const LOCAL_DEV_GROUP_MEMBER_FIXTURES = {
  [LOCAL_DEV_GROUP.id]: [
    { id: "local-dev-member-1", user_id: LOCAL_DEV_USER.id, name: LOCAL_DEV_USER.name, email: LOCAL_DEV_USER.email, role: "owner", division: "1" },
    { id: "local-dev-member-3", user_id: 999003, name: "\uac00\uac00\uac00", email: null, role: "member", division: "2" },
    { id: "local-dev-member-4", user_id: 999004, name: "\ub2e4\ub2e4\ub2e4", email: null, role: "member", division: "3" },
    { id: "local-dev-member-5", user_id: 999005, name: "\ub77c\ub77c\ub77c", email: null, role: "member", division: "4" },
    { id: "local-dev-member-6", user_id: 999006, name: "\ub9c8\ub9c8\ub9c8", email: null, role: "member", division: "5" },
    { id: "local-dev-member-7", user_id: 999007, name: "\ubc14\ubc14\ubc14", email: null, role: "member", division: "6" },
    { id: "local-dev-member-8", user_id: 999008, name: "\uc0ac\uc0ac\uc0ac", email: null, role: "member", division: "7" },
    { id: "local-dev-member-9", user_id: 999009, name: "\uc544\uc544\uc544", email: null, role: "member", division: "8" },
  ],
  [LOCAL_DEV_SECOND_GROUP.id]: [
    { id: "local-dev-member-2", user_id: LOCAL_DEV_SECOND_USER.id, name: LOCAL_DEV_SECOND_USER.name, email: LOCAL_DEV_SECOND_USER.email, role: "owner", division: "1" },
    { id: "local-dev-member-10", user_id: 999010, name: "\ub098\ub098\ub098", email: null, role: "member", division: "2" },
    { id: "local-dev-member-11", user_id: 999011, name: "\ucc28\ucc28\ucc28", email: null, role: "member", division: "3" },
    { id: "local-dev-member-12", user_id: 999012, name: "\uce74\uce74\uce74", email: null, role: "member", division: "4" },
    { id: "local-dev-member-13", user_id: 999013, name: "\ud0c0\ud0c0\ud0c0", email: null, role: "member", division: "5" },
    { id: "local-dev-member-14", user_id: 999014, name: "\ud30c\ud30c\ud30c", email: null, role: "member", division: "6" },
    { id: "local-dev-member-15", user_id: 999015, name: "\ud558\ud558\ud558", email: null, role: "member", division: "7" },
    { id: "local-dev-member-16", user_id: 999016, name: "\ud638\ud638\ud638", email: null, role: "member", division: "8" },
  ],
} as const;

export function getLocalDevGroupMembers(groupId: string) {
  return [...(LOCAL_DEV_GROUP_MEMBER_FIXTURES[groupId as keyof typeof LOCAL_DEV_GROUP_MEMBER_FIXTURES] ?? [])]
    .map((member) => ({
      ...member,
      joined_at: new Date(0).toISOString(),
      is_pre_member: false,
    }));
}

export type LocalDevPreMember = {
  id: string;
  name: string;
  division: string | null;
  status: "active" | "linked" | "deleted";
  created_at: string;
  claim_id: string | null;
  claim_status: "pending" | "approved" | "declined" | null;
  requested_by_id: number | null;
  requester_name: string | null;
  requested_at: string | null;
};

const LOCAL_DEV_PRE_MEMBER_KEY = "woorileague.localDev.preMembers";

function readLocalDevPreMemberStore(): Record<string, LocalDevPreMember[]> {
  if (!isLocalDevHost()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_DEV_PRE_MEMBER_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeLocalDevPreMemberStore(store: Record<string, LocalDevPreMember[]>) {
  window.localStorage.setItem(LOCAL_DEV_PRE_MEMBER_KEY, JSON.stringify(store));
}

export function getLocalDevPreMembers(groupId: string) {
  return [...(readLocalDevPreMemberStore()[groupId] ?? [])]
    .filter((member) => member.status !== "deleted");
}

export function createLocalDevPreMember(groupId: string, name: string, division?: string) {
  const store = readLocalDevPreMemberStore();
  const member: LocalDevPreMember = {
    id: `local-pre-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    division: division?.trim() || null,
    status: "active",
    created_at: new Date().toISOString(),
    claim_id: null,
    claim_status: null,
    requested_by_id: null,
    requester_name: null,
    requested_at: null,
  };
  store[groupId] = [...(store[groupId] ?? []), member];
  writeLocalDevPreMemberStore(store);
  return member;
}

export function deleteLocalDevPreMember(groupId: string, preMemberId: string) {
  const store = readLocalDevPreMemberStore();
  store[groupId] = (store[groupId] ?? []).filter((member) => member.id !== preMemberId);
  writeLocalDevPreMemberStore(store);
}

export function requestLocalDevPreMemberClaim(
  groupId: string,
  preMemberId: string,
  requester: { id: number; name: string },
) {
  const store = readLocalDevPreMemberStore();
  const member = (store[groupId] ?? []).find((item) => item.id === preMemberId);
  if (!member || member.status !== "active") return null;
  member.claim_id = `local-claim-${Date.now()}`;
  member.claim_status = "pending";
  member.requested_by_id = requester.id;
  member.requester_name = requester.name;
  member.requested_at = new Date().toISOString();
  writeLocalDevPreMemberStore(store);
  return member;
}

export function reviewLocalDevPreMemberClaim(
  groupId: string,
  preMemberId: string,
  action: "approve" | "decline",
) {
  const store = readLocalDevPreMemberStore();
  const member = (store[groupId] ?? []).find((item) => item.id === preMemberId);
  if (!member || member.claim_status !== "pending") return null;
  member.claim_status = action === "approve" ? "approved" : "declined";
  member.status = action === "approve" ? "linked" : "active";
  writeLocalDevPreMemberStore(store);
  return member;
}

export function findLocalDevGroup(identifier: string | null | undefined) {
  if (!identifier) return null;
  const normalized = identifier.trim().toLocaleLowerCase();
  return LOCAL_DEV_GROUPS.find((group) =>
    group.id.toLocaleLowerCase() === normalized
    || group.club_code?.toLocaleLowerCase() === normalized
  ) ?? null;
}

const LOCAL_DEV_PROFILES = [
  {
    email: LOCAL_DEV_EMAIL,
    password: LOCAL_DEV_PASSWORD,
    token: LOCAL_DEV_TOKEN,
    user: LOCAL_DEV_USER,
    group: LOCAL_DEV_GROUP,
  },
  {
    email: LOCAL_DEV_SECOND_EMAIL,
    password: LOCAL_DEV_SECOND_PASSWORD,
    token: LOCAL_DEV_SECOND_TOKEN,
    user: LOCAL_DEV_SECOND_USER,
    group: LOCAL_DEV_SECOND_GROUP,
  },
];

export function isLocalDevHost() {
  return import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function getLocalDevProfileByToken(token: string | null | undefined) {
  if (!isLocalDevHost()) return null;
  return LOCAL_DEV_PROFILES.find((profile) => profile.token === token) ?? null;
}

export function getLocalDevLogin(email: string, password: string) {
  if (!isLocalDevHost()) return null;
  return LOCAL_DEV_PROFILES.find(
    (profile) => profile.email === email && profile.password === password,
  ) ?? null;
}

export function isLocalDevToken(token: string | null | undefined) {
  return getLocalDevProfileByToken(token) !== null;
}

export function isLocalDevLogin(email: string, password: string) {
  return getLocalDevLogin(email, password) !== null;
}
