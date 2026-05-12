package com.cardgames.server.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    // DEV-209: look up by public UUID
    Optional<User> findByUuid(UUID uuid);

    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    // findById(Integer) inherited from JpaRepository — returns Optional<User>

    // DEV-206: hard-purge soft-deleted accounts older than cutoff.
    // JPQL DELETE bypasses @SQLRestriction so it reaches soft-deleted rows.
    @Modifying
    @Transactional
    @Query("DELETE FROM User u WHERE u.deletedAt IS NOT NULL AND u.deletedAt < :cutoff")
    int hardPurgeSoftDeleted(@Param("cutoff") LocalDateTime cutoff);
}
