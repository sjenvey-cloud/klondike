package com.cardgames.server.profile;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class AvatarConfig {

    /**
     * S3Presigner uses the default credential provider chain:
     *  - ECS task role in production (via IAM)
     *  - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars in local dev
     *
     * endpointOverride is set explicitly to the regional S3 endpoint so that
     * presigned PUT URLs always use the virtual-hosted regional form:
     *   https://{bucket}.s3.{region}.amazonaws.com/{key}?...
     *
     * Without this, AWS SDK may default to the global endpoint (s3.amazonaws.com),
     * which triggers a 307 redirect to the regional endpoint.  Browsers cannot
     * follow a cross-origin redirect on a CORS PUT request — they throw a TypeError
     * ("Failed to fetch") instead of receiving the redirect response.
     */
    @Bean
    public S3Presigner s3Presigner(@Value("${app.avatar.region:eu-north-1}") String region) {
        return S3Presigner.builder()
                .region(Region.of(region))
                .endpointOverride(URI.create("https://s3." + region + ".amazonaws.com"))
                .build();
    }
}
