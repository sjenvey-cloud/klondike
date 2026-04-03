package com.cardgames.server.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PatchProfileRequest(
    @NotBlank @Size(max = 100) String displayName
) {}
