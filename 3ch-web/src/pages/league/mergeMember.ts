import type { Participant } from "../../features/league/leagueCreationSlice";
import type { MemberRow } from "./LoadMembersDialog";

export function mergeMembers(
  prev: Participant[],
  selected: MemberRow[],
): Participant[] {
  const key = (x: { division: string; name: string }) =>
    `${x.division}__${x.name}`;

  const map = new Map<string, Participant>();
  prev.forEach((p) => map.set(key(p), p));

  selected.forEach((m) => {
    const k = key(m);
    if (!map.has(k)) {
      map.set(k, {
        division: m.division,
        name: m.name,
        paid: false,
        arrived: false,
        after: false,
      });
    }
  });

  return Array.from(map.values());
}
