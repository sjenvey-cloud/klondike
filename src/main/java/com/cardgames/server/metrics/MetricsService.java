package com.cardgames.server.metrics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.StandardUnit;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Service
public class MetricsService {

    private static final Logger log = LoggerFactory.getLogger(MetricsService.class);
    private static final String NAMESPACE = "KlondikePro/Application";

    @Value("${aws.cloudwatch.region:eu-north-1}")
    private String awsRegion;

    @Value("${aws.cloudwatch.environment:local}")
    private String environment;

    private CloudWatchClient cloudWatch;

    @PostConstruct
    public void init() {
        try {
            cloudWatch = CloudWatchClient.builder()
                .region(Region.of(awsRegion))
                .build();
        } catch (Exception e) {
            log.warn("MetricsService: could not initialise CloudWatch client — metrics will be skipped. Reason: {}", e.getMessage());
        }
    }

    @PreDestroy
    public void destroy() {
        if (cloudWatch != null) {
            try { cloudWatch.close(); } catch (Exception ignored) {}
        }
    }

    @Async
    public void recordSessionStarted() {
        put("sessions_started", 1.0);
    }

    @Async
    public void recordSessionCompleted() {
        put("sessions_completed", 1.0);
    }

    @Async
    public void recordDailyChallengeAttempt() {
        put("daily_challenge_attempts", 1.0);
    }

    private void put(String metricName, double value) {
        if (cloudWatch == null) return;
        try {
            Dimension dim = Dimension.builder()
                .name("Environment").value(environment)
                .build();
            MetricDatum datum = MetricDatum.builder()
                .metricName(metricName)
                .value(value)
                .unit(StandardUnit.COUNT)
                .dimensions(dim)
                .build();
            cloudWatch.putMetricData(PutMetricDataRequest.builder()
                .namespace(NAMESPACE)
                .metricData(datum)
                .build());
        } catch (Exception e) {
            log.debug("MetricsService: failed to put metric '{}': {}", metricName, e.getMessage());
        }
    }
}
