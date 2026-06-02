package com.cardgames.server.friends;

import java.util.List;

/**
 * DEV-334: Body for POST /api/v1/friends/game-center/import.
 * playerIds — Game Center teamPlayerIDs from GKLocalPlayer.loadFriends() on the device.
 */
public record GameCenterImportRequest(List<String> playerIds) {}
