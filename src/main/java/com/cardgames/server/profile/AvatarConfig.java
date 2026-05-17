package com.cardgames.server.profile;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class AvatarConfig {

    /**
     * S3Presigner uses the default credential provider chain:
     *  - ECS task role in production (via IAM)
     *  - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars in local dev
     */
    @Bean
    public S3Presigner s3Presigner(@Value("${app.avatar.region:eu-north-1}") String region) {
        return S3Presigner.builder()
                .region(Region.of(region))
                .build();
    }
}
