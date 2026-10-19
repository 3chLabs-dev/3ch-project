async function tournamentAccess(client, tournamentId, userId, permission = 'league') {
  const found = await client.query(`SELECT t.*, gm.role, gm.management_permissions,
    EXISTS (SELECT 1 FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id
      WHERE d.tournament_id=t.id AND p.member_id=$2 AND p.status IN ('applied','confirmed')) AS is_participant,
    EXISTS (SELECT 1 FROM tournament_invited_groups ig JOIN group_members member ON member.group_id=ig.group_id
      WHERE ig.tournament_id=t.id AND ig.status='accepted' AND member.user_id=$2) AS is_invited
    FROM tournaments t LEFT JOIN group_members gm ON gm.group_id=t.host_group_id AND gm.user_id=$2 WHERE t.id=$1`, [tournamentId, userId]);
  const tournament = found.rows[0];
  if (!tournament) return { allowed: false, manage: false };
  const adminPermission = permission === 'settlement' ? tournament.management_permissions?.settlement !== false : tournament.management_permissions?.[permission] === true;
  const manager = Number(tournament.created_by_id) === userId || tournament.role === 'owner' || (tournament.role === 'admin' && adminPermission);
  const subscription = manager ? await client.query("SELECT 1 FROM subscriptions WHERE user_id=$1 AND LOWER(plan)='premium' AND status='ACTIVE' AND started_at<=NOW() AND expires_at>NOW() LIMIT 1", [userId]) : { rowCount: 0 };
  const manage = manager && subscription.rowCount > 0;
  const applicantClub = await client.query(`SELECT 1 FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id JOIN group_members gm ON gm.group_id=p.source_group_id WHERE d.tournament_id=$1 AND gm.user_id=$2 AND p.status IN ('applied','confirmed') LIMIT 1`, [tournamentId, userId]);
  const eventAllowed = manager || !!tournament.role || tournament.is_participant || tournament.is_invited || applicantClub.rowCount > 0;
  return { allowed: tournament.status !== 'draft' || eventAllowed, eventAllowed, manage, tournament };
}
module.exports = { tournamentAccess };
