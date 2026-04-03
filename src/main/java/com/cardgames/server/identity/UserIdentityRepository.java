package com.cardgames.server.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, Integer> {

    Optional<UserIdentity> findByProviderAndProviderUserId(String provider, String providerUserId);
}
