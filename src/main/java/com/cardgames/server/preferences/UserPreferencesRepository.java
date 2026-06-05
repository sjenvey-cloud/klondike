package com.cardgames.server.preferences;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserPreferencesRepository extends JpaRepository<UserPreferences, Integer> {
    Optional<UserPreferences> findByUserId(int userId);

    /** Users who have opted into a daily reminder — candidates for DailyReminderJob (DEV-314). */
    List<UserPreferences> findByDailyReminderTimeIsNotNull();
}
