function parseApplication(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("신청 내용을 입력하세요.");
  const text = (key, max, required = false) => {
    const value = body[key] ?? "";
    if (typeof value !== "string" || value.length > max || (required && !value.trim()))
      throw new Error("필수 항목과 입력 길이를 확인해주세요.");
    return value.trim();
  };
  if (typeof body.club_created !== "boolean") throw new Error("클럽 생성 여부를 확인해주세요.");
  if (body.club_created && typeof body.season_configured !== "boolean") throw new Error("시즌 설정 여부를 선택해주세요.");
  const account_email = text("account_email", 200, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account_email)) throw new Error("계정 이메일을 확인해주세요.");
  const club_name = body.club_created ? text("club_name", 100, true) : "";
  const season_configured = body.club_created ? body.season_configured : null;
  const photo_url = season_configured ? text("photo_url", 2000) : "";
  if (photo_url) {
    let url;
    try { url = new URL(photo_url); } catch { throw new Error("공유 링크를 확인해주세요."); }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("http 또는 https 공유 링크를 입력해주세요.");
  }
  const needsHelp = !body.club_created || season_configured === false;
  const preferred_at = needsHelp ? text("preferred_at", 16) : "";
  if (preferred_at) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(preferred_at)) throw new Error("방문 희망 일시를 확인해주세요.");
    const date = new Date(`${preferred_at}:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== preferred_at) throw new Error("방문 희망 일시를 확인해주세요.");
  }
  return { account_email, club_created: body.club_created, club_name, season_configured, photo_url, contact: needsHelp ? text("contact", 200) : "", preferred_at };
}
function formatAnswers(a) {
  return [
    `계정 이메일: ${a.account_email}`,
    `클럽 생성: ${a.club_created ? '예' : '아니오 (직접 해주세요)'}`,
    ...(a.club_created ? [`클럽명: ${a.club_name}`, `시즌 설정: ${a.season_configured ? '예' : '아니오 (직접 해주세요)'}`] : []),
    ...(a.season_configured ? [`대진표 사진 공유 링크: ${a.photo_url || '미입력'}`] : []),
    // Keep historical contact answers visible even if submitted before conditional fields were introduced.
    ...(!a.club_created || a.season_configured === false || a.contact || a.preferred_at ? [
      `전화번호 / 카카오톡 ID: ${a.contact || '미입력'}`,
      `방문 희망 일시 (한국 시간): ${a.preferred_at?.replace('T', ' ') || '미입력'}`,
    ] : []),
  ].join('\n\n');
}
module.exports = { parseApplication, formatAnswers };
