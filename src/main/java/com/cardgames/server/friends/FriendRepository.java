package com.cardgames.server.friends;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

@Repository
public interface FriendRepository extends JpaRepository<Friend, Integer> {

    @Query("SELECT f FROM Friend f WHERE f.userIdA = :a AND f.userIdB = :b")
    Optional<Friend> findByPair(@Param("a") int a, @Param("b") int b);

    @Query("SELECT f FROM Friend f WHERE f.userIdA = :userId OR f.userIdB = :userId")
    List<Friend> findAllByUserId(@Param("userId") int userId);

    // DEV-232: Cursor-paginated variant — first page (no cursor)
    @Query("SELECT f FROM Friend f WHERE (f.userIdA = :userId OR f.userIdB = :userId) " +
           "ORDER BY f.createdAt ASC, f.id ASC")
    List<Friend> findPageByUserId(@Param("userId") int userId, Pageable pageable);

    // DEV-232: Cursor-paginated variant — subsequent pages (keyset after last seen row)
    @Query("SELECT f FROM Friend f WHERE (f.userIdA = :userId OR f.userIdB = :userId) " +
           "AND (f.createdAt > :afterDate OR (f.createdAt = :afterDate AND f.id > :afterId)) " +
           "ORDER BY f.createdAt ASC, f.id ASC")
    List<Friend> findPageByUserIdAfter(@Param("userId") int userId,
                                       @Param("afterDate") LocalDateTime afterDate,
                                       @Param("afterId") int afterId,
                                       Pageable pageable);

    default Optional<Friend> findFriendship(int idX, int idY) {
        int a = Math.min(idX, idY);
        int b = Math.max(idX, idY);
        return findByPair(a, b);
    }
}
