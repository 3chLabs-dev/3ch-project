import type { Group } from "../features/group/groupApi";

/**
 * 클럽 내 특정 권한을 가진 사용자인지 확인
 * @param group - 확인할 클럽
 * @param requiredRoles - 필요한 권한 목록
 * @returns 권한 보유 여부
 */
export const hasGroupPermission = (
  group: Group | null | undefined,
  requiredRoles: string[]
): boolean => {
  if (!group) return false;
  return requiredRoles.includes(group.role);
};

/**
 * 리더(owner)인지 확인
 */
export const isGroupOwner = (group: Group | null | undefined): boolean => {
  return group?.role === "owner";
};

/**
 * 리더 또는 운영진(owner/admin)인지 확인
 */
export const isGroupAdmin = (group: Group | null | undefined): boolean => {
  return group?.role === "owner" || group?.role === "admin";
};

/**
 * 일반 멤버인지 확인
 */
export const isGroupMember = (group: Group | null | undefined): boolean => {
  return !!group && ["owner", "admin", "member"].includes(group.role);
};

/**
 * 권한에 따른 한글 라벨 반환
 */
export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    owner: "리더",
    admin: "운영진",
    member: "일반 멤버",
  };
  return labels[role] || "알 수 없음";
};

/**
 * 여러 클럽 중 관리 권한(owner/admin)이 있는 클럽만 필터링
 */
export const filterAdminGroups = (groups: Group[]): Group[] => {
  return groups.filter((g) => g.role === "owner" || g.role === "admin");
};
