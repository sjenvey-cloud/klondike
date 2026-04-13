package com.cardgames.server.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {

    @Query("SELECT f FROM Friend f WHERE f.userIdA = :a AND f.userIdB = :b")
    Optional<Friend> findByPair(@Param("a") int a, @Param("b") int b);

    @Query("SELECT f FROM Friend f WHERE f.userIdA = :userId OR f.userIdB = :userId")
    List<Friend> findAllByUserId(@Param("userId") int userId);

    default Optional<Friend> findFriendship(int idX, int idY) {
        int a = Math.min(idX, idY);
        int b = Math.max(idX, idY);
        return findByPair(a, b);
    }
}
