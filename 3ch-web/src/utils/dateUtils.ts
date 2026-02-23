/**
 * pg(node-postgres)가 TIMESTAMP WITHOUT TIME ZONE을 Z 없이 반환할 수 있음.
 * Z가 없으면 브라우저가 로컬 시간(KST)으로 파싱해 오차 발생 → Z 강제 추가.
 * pool.js에 setTypeParser(1114) 설정 후에는 항상 Z가 붙어 와서 pass-through됨.
 */
export function toUTCDate(iso: string): Date {
  const s = iso.trim().replace(" ", "T");
  if (s.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/) && !s.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s + "Z");
  }
  return new Date(s);
}

export function formatLeagueDate(dateStr: string): string {
  const d = toUTCDate(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}(${days[d.getDay()]})`;
}

export function formatLeagueTime(dateStr: string): string {
  const d = toUTCDate(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** HTTP 환경에서 crypto.randomUUID가 없거나 예외를 던질 때 안전하게 대체 */
export function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}
