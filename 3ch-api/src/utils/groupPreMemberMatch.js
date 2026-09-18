function findUniqueExactPreMember(accountName, preMembers) {
  const name = typeof accountName === 'string' ? accountName.trim() : '';
  if (!name) return null;
  const matches = preMembers.filter((member) => member.name.trim() === name);
  return matches.length === 1 && matches[0].claim_status !== 'pending' ? matches[0] : null;
}

module.exports = { findUniqueExactPreMember };
