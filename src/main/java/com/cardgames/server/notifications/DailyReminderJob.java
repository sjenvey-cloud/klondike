package com.cardgames.server.notifications;

import com.cardgames.server.preferences.UserPreferences;
import com.cardgames.server.preferences.UserPreferencesRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * DEV-314: fires daily-challenge reminders at each user's chosen local time.
 *
 * Runs every 15 minutes. For each user who opted in, the stored time-zone offset
 * is applied to convert "now" into their local time; if their reminder time falls
 * in the current 15-minute slot and one hasn't already been sent on their local
 * date, a push is dispatched and the local date is recorded to de-dupe.
 *
 * No-ops entirely when APNs isn't configured, so it costs nothing until push is live.
 */
@Component
public class DailyReminderJob {

    private static final Logger log = LoggerFactory.getLogger(DailyReminderJob.class);

    private final UserPreferencesRepository prefsRepo;
    private final NotificationService       notificationService;

    public DailyReminderJob(UserPreferencesRepository prefsRepo,
                            NotificationService notificationService) {
        this.prefsRepo           = prefsRepo;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 */15 * * * *")   // every 15 minutes, on the 15
    @Transactional
    public void sendDueReminders() {
        if (!notificationService.isEnabled()) return;   // push disabled — skip all work

        List<UserPreferences> candidates = prefsRepo.findByDailyReminderTimeIsNotNull();
        if (candidates.isEmpty()) return;

        Instant nowUtc = Instant.now();

        for (UserPreferences p : candidates) {
            try {
                if (isDue(p, nowUtc)) {
                    ZonedDateTime localNow = nowUtc.atZone(ZoneOffset.UTC)
                            .plusMinutes(p.getDailyReminderTzOffset());
                    notificationService.sendToUser(
                        p.getUserId(),
                        "Daily Challenge",
                        "Today's hand is waiting — keep your streak going!",
                        Map.of("type", "daily_reminder")
                    );
                    p.setDailyReminderLastSent(localNow.toLocalDate());
                    prefsRepo.save(p);
                }
            } catch (Exception e) {
                log.warn("Daily reminder failed for user {}: {}", p.getUserId(), e.getMessage());
            }
        }
    }

    /** True when the reminder time falls in the trailing 15-minute slot and none sent today (local). */
    private boolean isDue(UserPreferences p, Instant nowUtc) {
        LocalTime reminder = p.getDailyReminderTime();
        if (reminder == null) return false;

        ZonedDateTime localNow = nowUtc.atZone(ZoneOffset.UTC).plusMinutes(p.getDailyReminderTzOffset());
        LocalDate localDate    = localNow.toLocalDate();
        LocalTime localTime    = localNow.toLocalTime();

        int nowMinutes = localTime.getHour() * 60 + localTime.getMinute();
        int remMinutes = reminder.getHour()  * 60 + reminder.getMinute();

        boolean inSlot       = remMinutes <= nowMinutes && remMinutes >= nowMinutes - 14;
        boolean notSentToday = !localDate.equals(p.getDailyReminderLastSent());
        return inSlot && notSentToday;
    }
}
