package com.cardgames.server.customleague;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomLeagueMemberRepository extends JpaRepository<CustomLeagueMember, Integer> {

    List<CustomLeagueMember> findByLeagueId(int leagueId);

    List<CustomLeagueMember> findByUserId(int userId);

    Optional<CustomLeagueMember> findByLeagueIdAndUserId(int leagueId, int userId);

    boolean existsByLeagueIdAndUserId(int leagueId, int userId);

    int countByLeagueId(int leagueId);
}
