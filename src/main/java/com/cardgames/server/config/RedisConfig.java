package com.cardgames.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

/**
 * DEV-165 fix: Spring Boot 3.2 removed the legacy spring.redis.* namespace.
 * ECS task def injects SPRING_REDIS_HOST; we read it directly so the env var
 * works regardless of which property namespace Spring resolves it under.
 */
@Configuration
public class RedisConfig {

    // ECS task def sets SPRING_REDIS_HOST; falls back to localhost for local dev
    @Value("${SPRING_REDIS_HOST:localhost}")
    private String redisHost;

    @Value("${SPRING_REDIS_PORT:6379}")
    private int redisPort;

    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        LettuceConnectionFactory factory = new LettuceConnectionFactory(
            new RedisStandaloneConfiguration(redisHost, redisPort));
        factory.setValidateConnection(false);
        return factory;
    }
}
