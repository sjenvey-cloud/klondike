package com.cardgames.server.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.actuate.health.CompositeHealth;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.stereotype.Component;

/**
 * TEMPORARY diagnostic (INFRA-1). Logs each /actuator/health component's status to
 * CloudWatch at startup, so we can see WHICH component is DOWN when the DB password
 * is sourced from a Secrets Manager secret — the deploy fails the ELB health check
 * for an as-yet-unexplained reason even though the app starts and connects to the DB.
 *
 * Uses the HealthEndpoint bean directly (not the HTTP endpoint), so component detail
 * is logged regardless of management.endpoint.health.show-details — no public exposure.
 *
 * REMOVE once INFRA-1 is diagnosed.
 */
@Component
public class HealthDiagnosticRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(HealthDiagnosticRunner.class);

    private final HealthEndpoint healthEndpoint;

    public HealthDiagnosticRunner(HealthEndpoint healthEndpoint) {
        this.healthEndpoint = healthEndpoint;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            HealthComponent health = healthEndpoint.health();
            log.warn("HEALTH-DIAG: overall status = {}", health.getStatus());
            if (health instanceof CompositeHealth composite) {
                composite.getComponents().forEach((name, component) ->
                    log.warn("HEALTH-DIAG: component '{}' = {}", name, component.getStatus()));
            }
        } catch (Exception e) {
            log.warn("HEALTH-DIAG: could not read health endpoint: {}", e.toString());
        }
    }
}
