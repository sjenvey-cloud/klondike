package com.cardgames.server.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    Optional<DeviceToken> findByUserIdAndDeviceId(int userId, String deviceId);

    /** All tokens for a user — used by NotificationService (DEV-311) to fan out a push. */
    List<DeviceToken> findByUserId(int userId);

    /** Clears any prior ownership of an APNs token before re-registering it. */
    @Transactional
    void deleteByToken(String token);
}
