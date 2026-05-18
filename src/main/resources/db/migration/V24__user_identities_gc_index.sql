-- V24: index to support fast Game Center (and future OAuth) provider lookups.
-- Without this, findByProviderAndProviderUserId performs a sequential scan.
-- game_center provider uses provider_user_id = GKLocalPlayer.teamPlayerID.
CREATE INDEX IF NOT EXISTS idx_user_identities_provider_uid
    ON user_identities (provider, provider_user_id);
