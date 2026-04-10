package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.TrustScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TrustScoreRepository extends JpaRepository<TrustScore, Long> {
    Optional<TrustScore> findBySellerId(Long sellerId);

    @Query("SELECT AVG(r.rating) FROM Review r JOIN r.product p WHERE p.seller.id = :sellerId")
    Double getAverageRatingBySellerId(@Param("sellerId") Long sellerId);

    @Query("SELECT COUNT(r) FROM Review r JOIN r.product p WHERE p.seller.id = :sellerId")
    Integer getTotalReviewsBySellerId(@Param("sellerId") Long sellerId);

    @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.product.seller.id = :sellerId AND o.status = com.trash.ecommerce.entity.OrderStatus.FINISHED")
    Integer getSuccessfulOrdersBySellerId(@Param("sellerId") Long sellerId);

    @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.product.seller.id = :sellerId AND o.status = com.trash.ecommerce.entity.OrderStatus.CANCELLED")
    Integer getCancelledOrdersBySellerId(@Param("sellerId") Long sellerId);

    @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.product.seller.id = :sellerId")
    Integer getTotalOrdersBySellerId(@Param("sellerId") Long sellerId);
}
