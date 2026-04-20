package com.cardgames.server.customleague;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomLeagueRepository extends JpaRepository<CustomLeague, Integer> {
}
