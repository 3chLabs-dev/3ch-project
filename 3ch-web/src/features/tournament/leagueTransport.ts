import type { FetchArgs } from "@reduxjs/toolkit/query";

// Persisted snapshots live outside RTK's optimistic cache. Writes never use optimistic values as expected state.
const matches = new Map<string, Record<string, unknown>>();
const programs = new Map<string, { updated_at: string; program_data: { blocks?: unknown[] } }>();
const queues = new Map<string, Promise<unknown>>();
export async function tournamentLeagueRequest<T extends { data?: unknown; error?: unknown }>(
  args: string | FetchArgs, execute: (args: string | FetchArgs) => Promise<T>, onMutation: () => void,
): Promise<T | undefined> {
  const input = typeof args === "string" ? { url: args } : args;
  const match = /^\/league\/(tournament~[a-f\d-]{36}~[a-f\d-]{36})(.*)$/i.exec(input.url);
  if (!match) return undefined;
  const [, key, suffix] = match;
  const [, id, divisionId] = key.split("~");
  const prefix = `/tournaments/${id}/divisions/${divisionId}/league`;
  const method = input.method ?? "GET";
  const perform = async (): Promise<T> => {
    let body = input.body as Record<string, unknown> | undefined;
    const matchEdit = /^\/matches\/([a-f\d-]{36})$/.exec(suffix);
    if (suffix === "/openai-vision/scan") {
      const round = new URLSearchParams(window.location.search).get("round") ?? "1";
      return execute({ ...input, url: `/tournaments/${id}/divisions/${divisionId}/rounds/${round}/openai-vision/scan` });
    }
    if (method === "PATCH" && suffix === "/matches/batch-results") {
      const items = body?.matches as Array<Record<string, unknown>>;
      if (!items?.length) return { error: { status: 400, data: { message: "저장할 결과가 없습니다." } } } as T;
      const snapshots = items.map(item => matches.get(`${key}:${item.match_id}`));
      if (snapshots.some(row => !row) || new Set(snapshots.map(row => row?.program_round)).size !== 1) return { error: { status: 409, data: { message: "현재 라운드 경기를 다시 불러와주세요." } } } as T;
      const response = await execute({ ...input, url: `/tournaments/${id}/divisions/${divisionId}/rounds/${snapshots[0]!.program_round}/matches/batch-results`,
        body: { matches: items.map((item, index) => ({ ...item, expected: { score_a: snapshots[index]!.score_a ?? null, score_b: snapshots[index]!.score_b ?? null, status: snapshots[index]!.status === "done" ? "completed" : snapshots[index]!.status, court: snapshots[index]!.court ?? null } })) } });
      if (!response.error) onMutation();
      return response;
    }
    if (method === "PATCH" && matchEdit) {
      const saved = matches.get(`${key}:${matchEdit[1]}`);
      if (!saved) await capture(await execute(`${prefix}/matches`), "/matches");
      const persisted = matches.get(`${key}:${matchEdit[1]}`);
      const updates = Object.fromEntries(Object.entries(body ?? {}).filter(([field]) => ["score_a", "score_b", "status", "court"].includes(field)));
      if (updates.status === "done") updates.status = "completed";
      // Slot propagation is performed from persisted graph edges by the server.
      if (!Object.keys(updates).length) return { data: { match: persisted } } as T;
      body = { updates, expected: persisted ? {
        score_a: persisted.score_a ?? null, score_b: persisted.score_b ?? null,
        status: persisted.status === "done" ? "completed" : persisted.status, court: persisted.court ?? null,
      } : null };
    }
    if (method === "DELETE" && matchEdit) {
      if (!window.confirm("이 미진행 경기를 취소하시겠습니까? 참가자와 편성 기록은 보존되며 완료·진행 중인 경기는 취소할 수 없습니다.")) return { error: { status: 400, data: { message: "경기 취소를 중단했습니다." } } } as T;
      body = { confirmation_intent: "CANCEL_UNPLAYED_TOURNAMENT_MATCH" };
    }
    if (method === "DELETE" && suffix === "/program") {
      if (!window.confirm("이 부문의 프로그램을 삭제하시겠습니까? 모든 라운드·조/팀 편성·경기·점수 결과가 삭제됩니다. 참가자 명단은 유지하며 변경 전 기록은 관리자 감사 기록에 보관합니다.")) return { error: { status: 400, data: { message: "프로그램 삭제를 중단했습니다." } } } as T;
      body = { confirmation_intent: "DELETE_TOURNAMENT_PROGRAM" };
    }
    if ((method === "PUT" && suffix === "/program") || (method === "POST" && suffix === "/reconfigure")) {
      if (!programs.has(key)) await capture(await execute(`${prefix}/program`), "/program");
      const previous = programs.get(key);
      const incoming = body?.program_data as { blocks?: unknown[]; tournament_revision?: string } | undefined;
      body = { ...body, expected_updated_at: incoming?.tournament_revision ?? previous?.updated_at };
      if (suffix === "/reconfigure") {
        if (!window.confirm("이 라운드의 미진행 편성을 다시 구성하시겠습니까? 기존 미진행 경기는 취소 상태로 보관하고 새 편성으로 경기를 만듭니다. 점수나 진행·완료 기록이 있으면 변경하지 않습니다.")) return { error: { status: 400, data: { message: "편성 재구성을 중단했습니다." } } } as T;
        body.confirmation_intent = "RECONFIGURE_UNPLAYED_TOURNAMENT_ROUND";
      }
      if ((incoming?.blocks?.length ?? 0) < (previous?.program_data.blocks?.length ?? 0)) {
        if (!window.confirm("삭제한 빈 라운드의 설정을 제거하시겠습니까? 편성·경기가 있는 라운드는 삭제되지 않습니다.")) return { error: { status: 400, data: { message: "라운드 삭제를 중단했습니다." } } } as T;
        body.confirmation_intent = "DELETE_EMPTY_PROGRAM_ROUNDS";
      }
    }
    if (method === "POST" && suffix === "/program/matches/sync" && body?.reset_results) {
      if (!window.confirm("이 부문의 모든 결과를 초기화하시겠습니까? 1라운드의 점수·진행 상태와 자동 진출 배정을 초기화하고, 후속 라운드 경기는 기록을 보관한 채 취소합니다. 참가자·조 편성·수동 배정은 유지합니다. 변경 전 전체 기록은 감사 기록에 보관합니다.")) return { error: { status: 400, data: { message: "초기화를 중단했습니다." } } } as T;
      const reset = await execute({ url: `${prefix}/reset`, method: "POST", body: { confirmation_intent: "RESET_TOURNAMENT_RESULTS" } });
      await capture(reset, "/program");
      if (!reset.error) onMutation();
      return reset;
    }
    if (suffix === "/program/matches/sync" && body?.assignment_intent) {
      if (!window.confirm("선택한 미진행 경기의 참가자 배정을 변경하시겠습니까? 점수·진행·완료 기록이 있는 경기는 변경되지 않습니다.")) return { error: { status: 400, data: { message: "참가자 배정 변경을 중단했습니다." } } } as T;
      const incoming = body.matches as Array<Record<string, unknown>>;
      body = { ...body, expected_assignments: incoming.map(row => matches.get(`${key}:${row.id}`)).filter(Boolean) };
    }
    const response = await execute({ ...input, url: `${prefix}${body?.restore_match_id ? "/restore-no-game" : suffix}`, body });
    await capture(response, suffix === "/reconfigure" ? "/program" : suffix);
    if (method !== "GET" && !response.error) onMutation();
    return response;
  };
  async function capture(response: T, path: string) {
    if (response.error || !response.data) return;
    const data = response.data as { matches?: Array<Record<string, unknown>>; match?: Record<string, unknown>; program?: { updated_at: string; program_data: { blocks?: unknown[] } } };
    if (path === "/matches") for (const row of data.matches ?? []) matches.set(`${key}:${row.id}`, row);
    if (data.match) matches.set(`${key}:${data.match.id}`, data.match);
    if (data.program) programs.set(key, data.program);
  }
  if (method === "GET") return perform();
  const previous = queues.get(key) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(perform);
  queues.set(key, job);
  try { return await job; } finally { if (queues.get(key) === job) queues.delete(key); }
}
