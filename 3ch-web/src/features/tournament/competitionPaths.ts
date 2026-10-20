/** Preserve league routes; scope tournament imports to a persisted division and round. */
export function competitionApiPath(resource: string, action: string): string {
  if (!resource.startsWith("tournament:")) return `/league/${resource}/${action}`;
  const [, id, divisionId, round] = resource.split(":");
  return `/tournaments/${id}/divisions/${divisionId}/rounds/${round}/${action}`;
}
