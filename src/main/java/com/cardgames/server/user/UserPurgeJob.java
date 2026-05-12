package com.cardgames.server.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * DEV-206: GDPR two-phase erasure — hard-purges soft-deleted user accounts
 * older than 30 days every night at 02:00 UTC.
 *
 * Phase 1: AccountService.deleteAccount() anonymises the user row and sets deleted_at.
 * Phase 2: This job permanently deletes users WHERE deleted_at < NOW() - 30 days.
 *          ON DELETE CASCADE constraints (V14) then remove all related game data.
 */
@Component
public class UserPurgeJob {

    private static final Logger log = LoggerFactory.getLogger(UserPurgeJob.class);

    private final UserRepository userRepository;

    public UserPurgeJob(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Scheduled(cron = "0 0 2 * * *") // 02:00 UTC daily
    @Transactional
    public void purgeExpiredAccounts() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        int purged = userRepository.hardPurgeSoftDeleted(cutoff);
        if (purged > 0) {
            log.info("UserPurgeJob: hard-purged {} account(s) soft-deleted before {}", purged, cutoff);
        }
    }
}
