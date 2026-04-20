package com.cardgames.server.customleague;

/** One member in the GET /custom-leagues/{id} detail response */
public record CustomLeagueMemberEntry(
    int     userId,
    String  displayName,
    boolean isFriend,           // true if this member is a friend of the requesting user
    boolean hasPendingRequest   // true if requesting user already sent a friend request
) {}
