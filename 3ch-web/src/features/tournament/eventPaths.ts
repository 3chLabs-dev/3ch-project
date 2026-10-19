export const tournamentEventId = (id: string) => `tournament:${id}`;
export const isTournamentEvent = (id: string) => id.startsWith("tournament:");
export const eventSourceId = (id: string) => isTournamentEvent(id) ? id.slice(11) : id;
export const drawPath = (id: string, suffix = "") => isTournamentEvent(id) ? `/tournament/${eventSourceId(id)}/draw${suffix}` : `/draw/${id}${suffix}`;
export const drawApiPath = (id: string) => isTournamentEvent(id) ? `/tournaments/${eventSourceId(id)}/draw` : `/draw/${id}`;
