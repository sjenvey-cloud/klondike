-- DEV-204: Two-phase GDPR erasure — phase 1 (soft-delete) column
-- Phase 2 (hard-purge after 30 days) is handled by UserPurgeJob (@Scheduled)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
