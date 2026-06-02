package com.cardgames.server.friends;

/**
 * DEV-334: one Game Center friend matched to an existing Klondike Pro account.
 * `addedAsRequest` is true when a pending friend request was created as part of the import.
 */
public record GameCenterMatchEntry(
    int     userId,
    String  displayName,
    String  avatarUrl,
    boolean alreadyFriend,
    boolean addedAsRequest
) {}
