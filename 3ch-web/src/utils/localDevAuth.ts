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
  creator_name: "테스트",
  member_count: 1,
  role: "owner",
  division: null,
};

export function isLocalDevHost() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function isLocalDevToken(token: string | null | undefined) {
  return isLocalDevHost() && token === LOCAL_DEV_TOKEN;
}

export function isLocalDevLogin(email: string, password: string) {
  return isLocalDevHost() && email === LOCAL_DEV_EMAIL && password === LOCAL_DEV_PASSWORD;
}
