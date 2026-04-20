package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.Story;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StoryRepository extends JpaRepository<Story, Long> {
        @Query("""
                        SELECT s
                        FROM Story s
                        LEFT JOIN TrustScore ts ON ts.seller.id = s.seller.id
                        WHERE s.isPublished = true
                            AND (s.expiresAt IS NULL OR s.expiresAt > :now)
                        ORDER BY COALESCE(ts.avgRating, 0) DESC, s.createdAt DESC
                        """)
        Page<Story> findPublicActiveStoriesRanked(@Param("now") LocalDateTime now, Pageable pageable);

        @Query("""
                        SELECT s
                        FROM Story s
                        WHERE s.seller.id = :sellerId
                            AND s.isPublished = true
                            AND (s.expiresAt IS NULL OR s.expiresAt > :now)
                        ORDER BY s.createdAt DESC
                        """)
        List<Story> findPublicActiveBySeller(@Param("sellerId") Long sellerId, @Param("now") LocalDateTime now);

    List<Story> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
    List<Story> findByBatchIdOrderByCreatedAtDesc(String batchId);
}
