package com.cardgames.server.friends;

/**
 * Counts backing the Social tab badge: incoming connect requests still pending
 * plus accepted-but-unseen acknowledgments of requests the user sent.
 */
public record SocialBadgeCounts(long received, long accepted, long total) {}
