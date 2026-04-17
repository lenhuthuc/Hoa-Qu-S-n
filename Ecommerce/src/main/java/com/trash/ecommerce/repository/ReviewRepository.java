package com.trash.ecommerce.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.trash.ecommerce.entity.Review;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository <Review, Long>{
    List<Review> findByProductId(Long productId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.user.id = :userId AND r.product.id = :productId")
    long countByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);
}
