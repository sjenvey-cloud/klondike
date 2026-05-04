package com.cardgames.server.daily;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Generates daily-challenge hands at midnight UTC for all draw modes.
 * This ensures the daily is available the moment a new day starts,
 * rather than waiting for the first user request.
 */
@Component
public class DailyScheduler {

    private static final Logger log = LoggerFactory.getLogger(DailyScheduler.class);
    private static final List<String> DRAW_MODES = List.of("draw3", "draw1");

    private final DailyGeneratorService generator;

    public DailyScheduler(DailyGeneratorService generator) {
        this.generator = generator;
    }

    /**
     * Fires at 00:00:00 UTC every day.
     * Generates the daily hand for each draw mode. Idempotent — safe if it
     * fires more than once or if the lazy fallback already ran.
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "UTC")
    public void generateDailies() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        log.info("DailyScheduler: generating challenges for {}", today);

        for (String mode : DRAW_MODES) {
            try {
                generator.ensureDaily(today, mode);
            } catch (Exception e) {
                log.error("DailyScheduler: failed to generate daily [{}] for {}: {}", mode, today, e.getMessage(), e);
            }
        }

        log.info("DailyScheduler: done for {}", today);
    }
}
