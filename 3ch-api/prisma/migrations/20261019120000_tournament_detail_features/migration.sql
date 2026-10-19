-- Read adapters let shared event screens consume tournament data without creating league records.
CREATE VIEW tournament_event_context AS
SELECT id, NULL::varchar AS league_code, title AS name, title, 'TOURNAMENT'::varchar AS type,
       starts_at AS start_date, host_group_id AS group_id, created_by_id,
       created_by_id AS billing_owner_id, bank_account, entry_fee::text AS entry_fee
FROM tournaments;
CREATE VIEW tournament_event_participants AS
SELECT p.id, d.tournament_id, p.name || ' (' || COALESCE(g.name,'개인') || ')' AS name, p.member_division AS division, p.member_id AS user_id,
       false AS is_bot, false AS after
FROM tournament_participants p JOIN tournament_divisions d ON d.id=p.division_id LEFT JOIN groups g ON g.id=p.source_group_id
WHERE p.status IN ('applied','confirmed');

CREATE TABLE tournament_draws (LIKE draws INCLUDING ALL);
ALTER TABLE tournament_draws RENAME COLUMN league_id TO tournament_id;
ALTER TABLE tournament_draws ALTER COLUMN tournament_id TYPE uuid USING tournament_id::uuid;
ALTER TABLE tournament_draws ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;
ALTER TABLE tournament_draws ADD FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE TABLE tournament_draw_prizes (LIKE draw_prizes INCLUDING ALL);
ALTER TABLE tournament_draw_prizes ADD FOREIGN KEY (draw_id) REFERENCES tournament_draws(id) ON DELETE RESTRICT;
CREATE TABLE tournament_draw_winners (LIKE draw_winners INCLUDING ALL);
ALTER TABLE tournament_draw_winners ADD FOREIGN KEY (draw_id) REFERENCES tournament_draws(id) ON DELETE RESTRICT;
ALTER TABLE tournament_draw_winners ADD FOREIGN KEY (prize_id) REFERENCES tournament_draw_prizes(id) ON DELETE RESTRICT;

CREATE TABLE tournament_after_party_settlements (LIKE after_party_settlements INCLUDING ALL);
ALTER TABLE tournament_after_party_settlements RENAME COLUMN league_id TO tournament_id;
ALTER TABLE tournament_after_party_settlements ALTER COLUMN tournament_id TYPE uuid USING tournament_id::uuid;
ALTER TABLE tournament_after_party_settlements ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;
ALTER TABLE tournament_after_party_settlements ADD FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE tournament_after_party_settlements ADD FOREIGN KEY (archived_by_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE TABLE tournament_after_party_share_links (LIKE after_party_share_links INCLUDING ALL);
ALTER TABLE tournament_after_party_share_links RENAME COLUMN league_id TO tournament_id;
ALTER TABLE tournament_after_party_share_links ALTER COLUMN tournament_id TYPE uuid USING tournament_id::uuid;
ALTER TABLE tournament_after_party_share_links ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;
ALTER TABLE tournament_after_party_share_links ADD FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE TABLE tournament_after_party_payments (LIKE after_party_payments INCLUDING ALL);
ALTER TABLE tournament_after_party_payments RENAME COLUMN league_id TO tournament_id;
ALTER TABLE tournament_after_party_payments ALTER COLUMN tournament_id TYPE uuid USING tournament_id::uuid;
ALTER TABLE tournament_after_party_payments ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;
ALTER TABLE tournament_after_party_payments ADD FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE TABLE tournament_after_party_receipt_scans (LIKE after_party_receipt_scans INCLUDING ALL);
ALTER TABLE tournament_after_party_receipt_scans RENAME COLUMN league_id TO tournament_id;
ALTER TABLE tournament_after_party_receipt_scans ALTER COLUMN tournament_id TYPE uuid USING tournament_id::uuid;
ALTER TABLE tournament_after_party_receipt_scans ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;

-- Existing matches retain their original round_no. Never infer a program-round assignment for historical results.
ALTER TABLE tournament_matches ADD COLUMN program_round INTEGER CHECK (program_round > 0);
CREATE INDEX tournament_matches_program_round_idx ON tournament_matches(division_id, program_round, match_order);
CREATE INDEX tournament_matches_participant_a_id_idx ON tournament_matches(participant_a_id);
CREATE INDEX tournament_matches_participant_b_id_idx ON tournament_matches(participant_b_id);
