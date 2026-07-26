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
