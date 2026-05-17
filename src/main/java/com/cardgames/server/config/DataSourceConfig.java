package com.cardgames.server.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * DEV-215: Routing DataSource that sends read-only transactions to the RDS
 * read replica and read-write transactions to the primary instance.
 *
 * When no replica endpoint is configured (local dev, staging without replica)
 * all traffic falls through to the primary DataSource.
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url}")
    private String primaryUrl;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password}")
    private String password;

    @Value("${spring.datasource.replica-url:}")
    private String replicaUrl;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariDataSource primary = buildPool("primary", primaryUrl);

        if (replicaUrl == null || replicaUrl.isBlank()) {
            log.info("DataSourceConfig: no replica URL configured — all queries use primary");
            return primary;
        }

        HikariDataSource replica = buildPool("replica", replicaUrl);
        log.info("DataSourceConfig: read replica configured at {}", replicaUrl);

        RoutingDataSource routing = new RoutingDataSource();
        Map<Object, Object> targets = new HashMap<>();
        targets.put(DataSourceType.PRIMARY, primary);
        targets.put(DataSourceType.REPLICA, replica);
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(primary);
        routing.afterPropertiesSet();

        // Wrap in LazyConnectionDataSourceProxy so the routing key is evaluated
        // after the transaction boundary is established (i.e. after @Transactional
        // sets the readOnly flag), not at connection-acquisition time.
        return new LazyConnectionDataSourceProxy(routing);
    }

    private HikariDataSource buildPool(String poolName, String url) {
        HikariDataSource ds = new HikariDataSource();
        ds.setPoolName("HikariPool-" + poolName);
        ds.setJdbcUrl(url);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setDriverClassName("org.postgresql.Driver");
        ds.setMaximumPoolSize(10);
        ds.setMinimumIdle(2);
        ds.setConnectionTimeout(3000);
        ds.setIdleTimeout(600000);
        ds.setMaxLifetime(1800000);
        return ds;
    }

    enum DataSourceType { PRIMARY, REPLICA }

    static class RoutingDataSource extends AbstractRoutingDataSource {
        @Override
        protected Object determineCurrentLookupKey() {
            return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
                ? DataSourceType.REPLICA
                : DataSourceType.PRIMARY;
        }
    }
}
