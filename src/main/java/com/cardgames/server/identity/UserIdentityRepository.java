package com.cardgames.server.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, Integer> {

    Optional<UserIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);

    /** All auth providers linked to a user — used for ProfileResponse.linkedProviders (DEV-333). */
    List<UserIdentity> findByUserId(int userId);
}
