ALTER TABLE tournaments ADD COLUMN entry_fee INTEGER;
ALTER TABLE tournaments ADD COLUMN bank_account VARCHAR(300);
ALTER TABLE tournaments ADD CONSTRAINT tournament_entry_fee_nonnegative CHECK (entry_fee IS NULL OR entry_fee >= 0);
