# Production data safety rules

These rules apply to every change in this repository.

- Treat league results, matches, participants, clubs, memberships, rankings, payments, and their relationships as protected production data.
- A UI/layout/ranking/navigation/generation/refactoring/deployment change must never delete, reset, replace, or silently rewrite protected data.
- Generated or client-derived state is never more authoritative than persisted server state. Preserve persisted participants, scores, statuses, manual ordering, and manual assignments when merging or regenerating data.
- Synchronization endpoints must be transactional and non-destructive by default. If an incoming payload omits a persisted record that contains user-entered data, reject the whole request and roll back rather than deleting or overwriting it.
- Destructive operations require a dedicated administrator action, a clear confirmation dialog describing exactly what will be lost, and an explicit server-validated confirmation intent. Do not reuse ordinary save, refresh, navigation, deployment, or sync actions for deletion/reset.
- Do not infer that data is unused from a generated flag such as `is_no_game`, display filtering, current participant order, or a client cache. Check persisted score/status and relationships on the server.
- Do not add automatic cleanup of historical or unmatched records without an approved retention policy and a recoverable backup/audit path.
- For changes touching protected data paths, test at minimum: existing completed results survive regeneration; completed matches cannot expose reset controls; omitted completed matches make sync fail atomically; explicit confirmed reset still works; rankings and later-round qualification continue to use persisted results.
- Before deployment, state whether a change can mutate protected data and identify the API endpoints involved. If that cannot be proven safe, stop and do not deploy.
