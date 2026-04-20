package com.cardgames.server.customleague;

import java.util.List;

public record CreateLeagueRequest(String name, List<Integer> memberIds) {}
