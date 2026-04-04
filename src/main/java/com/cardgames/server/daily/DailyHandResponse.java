package com.cardgames.server.daily;

import com.cardgames.server.hand.HandResponse;

public record DailyHandResponse(HandResponse hand, boolean userHasRankedAttempt) {}
