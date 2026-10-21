import { useCallback } from "react";
import { useLocation, useNavigate as useRouterNavigate, useParams as useRouterParams, useSearchParams as useRouterSearchParams } from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";

export const tournamentLeagueKey = (id: string, divisionId: string) => `tournament~${id}~${divisionId}`;
export function parseTournamentLeagueKey(key: string) {
  const match = /^tournament~([a-f\d-]{36})~([a-f\d-]{36})$/i.exec(key);
  return match ? { id: match[1], divisionId: match[2] } : null;
}
export function competitionPublicPath(key: string, page = "") {
  const scope = parseTournamentLeagueKey(key);
  return scope ? `/tournament/${scope.id}${page ? `/divisions/${scope.divisionId}/${page}` : ""}` : `/league/${key}${page ? `/${page}` : ""}`;
}

// The actual league screens keep their UI; only resource identity and destinations differ.
export function useCompetitionParams<T extends Record<string, string | undefined>>() {
  const params = useRouterParams();
  const location = useLocation();
  return { ...params, ...(location.pathname.startsWith("/tournament/") && params.id && params.divisionId
    ? { id: tournamentLeagueKey(params.id, params.divisionId) } : {}) } as T;
}

export function useCompetitionNavigate() {
  const navigate = useRouterNavigate();
  return useCallback((to: To | number, options?: NavigateOptions) => {
    if (typeof to === "number") { navigate(to); return; }
    if (typeof to !== "string") { navigate(to, options); return; }
    const match = /^\/league\/(tournament~[a-f\d-]{36}~[a-f\d-]{36})([^?]*)(\?.*)?$/i.exec(to);
    if (!match) { navigate(to, options); return; }
    const scope = parseTournamentLeagueKey(match[1])!;
    const base = `/tournament/${scope.id}/divisions/${scope.divisionId}`;
    const query = new URLSearchParams(match[3]);
    const path = match[2];
    let destination = `/tournament/${scope.id}`;
    if (path === "/program/new") { destination = `${base}/program`; query.set("edit", "1"); }
    else if (path === "/program") destination = `${base}/program/view`;
    else if (path.includes("matches")) destination = `${base}/matches`;
    else if (path.includes("results")) destination = `${base}/results`;
    else if (path.includes("bracket") || path.includes("vision")) destination = `${base}/bracket`;
    else if (path.includes("grouping")) destination = `${base}/groups`;
    navigate(`${destination}${query.size ? `?${query}` : ""}`, options);
  }, [navigate]);
}

export function useCompetitionSearchParams(): ReturnType<typeof useRouterSearchParams> {
  const [params, setParams] = useRouterSearchParams();
  const location = useLocation();
  if (!location.pathname.startsWith("/tournament/")) return [params, setParams];
  const scoped = new URLSearchParams(params);
  scoped.set("program", "1");
  if (location.pathname.endsWith("/program")) scoped.set("edit", "true");
  return [scoped, setParams];
}
