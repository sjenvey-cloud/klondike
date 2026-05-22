package com.cardgames.server.daily;

import com.cardgames.server.hand.HandResponse;

/**
 * Wraps the hand payload with the calendar date the challenge was issued for.
 * The client uses {@code date} to display the correct challenge date and to tag
 * sessions correctly — rather than relying on the client clock which can show
 * tomorrow after local midnight even though the backend is still serving today's hand.
 */
public record DailyHandResponse(HandResponse hand, boolean userHasRankedAttempt, String date) {}
