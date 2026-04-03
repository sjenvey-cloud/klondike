package com.cardgames.server.deal;

import java.util.ArrayList;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.cardgames.server.deal.Deal;

@Repository
public interface DealRepository extends JpaRepository<Deal, Integer> {

	Deal findById(int id);
	
	@Query(value = "select e1.* FROM" +
				   " (SELECT DISTINCT moves FROM deal where deckid = :deckid ORDER BY moves ASC LIMIT :num) s1" +
				   " JOIN deal e1" +
				   " ON e1.moves = s1.moves" +
				   " ORDER BY e1.moves ASC", nativeQuery = true)
	ArrayList<Deal> findTopMovesForADeck(@Param("deckid") int deckid,
										 @Param("num")    int num);
	
	
	@Query(value = "select e1.* FROM" +
			   " (SELECT DISTINCT timeseconds FROM deal where deckid = :deckid ORDER BY timeseconds ASC LIMIT :num) s1" +
			   " JOIN deal e1" +
			   " ON e1.timeseconds = s1.timeseconds" +
			   " ORDER BY e1.timeseconds ASC", nativeQuery = true)
	ArrayList<Deal> findTopTimesForADeck(@Param("deckid") int deckid,
									     @Param("num")    int num);
	
	@Query(value = "select e1.* FROM" +
			   " (SELECT DISTINCT moves FROM deal where userid = :userid ORDER BY moves ASC LIMIT :num) s1" +
			   " JOIN deal e1" +
			   " ON e1.moves = s1.moves" +
			   " ORDER BY e1.moves ASC", nativeQuery = true)
	ArrayList<Deal> findTopMovesForAUser(@Param("userid") int userid,
									 	 @Param("num")    int num);
	
	@Query(value = "select e1.* FROM" +
			   " (SELECT DISTINCT timeseconds FROM deal where userid = :userid ORDER BY timeseconds ASC LIMIT :num) s1" +
			   " JOIN deal e1" +
			   " ON e1.timeseconds = s1.timeseconds" +
			   " ORDER BY e1.timeseconds ASC", nativeQuery = true)
	ArrayList<Deal> findTopTimesForAUser(@Param("userid") int userid,
									     @Param("num")    int num);
	
	//users top moves from all decks
	//1) get a set of all deals a user has played im
	String query = "";
}
