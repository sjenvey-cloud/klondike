package com.cardgames.server.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

/**
 * DEV-231: Global OpenAPI definition.
 *
 * Swagger UI is served at /swagger-ui (→ /swagger-ui/index.html).
 * Raw OpenAPI spec:   /v3/api-docs
 *
 * Security: every endpoint requires a Bearer JWT except the /auth/** routes.
 * The Swagger UI "Authorize" dialog accepts a raw access token.
 */
@Configuration
@OpenAPIDefinition(
    info = @Info(
        title       = "Klondike Pro API",
        version     = "1.0",
        description = "REST API for Klondike Pro — a competitive online solitaire platform."
    ),
    servers = {
        @Server(url = "http://localhost:8080", description = "Local development"),
        @Server(url = "https://klondikepro.app", description = "Production")
    },
    security = @SecurityRequirement(name = "bearerAuth")
)
@SecurityScheme(
    name        = "bearerAuth",
    type        = SecuritySchemeType.HTTP,
    scheme      = "bearer",
    bearerFormat = "JWT",
    in          = SecuritySchemeIn.HEADER,
    description = "Paste the access_token returned by POST /api/v1/auth/login"
)
public class OpenApiConfig {}
