package com.trash.ecommerce.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.trash.ecommerce.entity.Order;
import com.trash.ecommerce.entity.OrderStatus;

import java.util.Date;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("SELECT o FROM Order o WHERE o.user.id = :userId AND (o.masterOrder = false OR o.masterOrder IS NULL) ORDER BY o.createAt DESC")
    List<Order> findByUserIdOrderByCreateAtDesc(@Param("userId") Long userId);

    List<Order> findByParentOrderIdOrderByCreateAtAsc(Long parentOrderId);

    List<Order> findBySellerIdOrderByCreateAtDesc(Long sellerId);

    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.createAt < :cutoffTime AND o.parentOrder IS NULL")
    List<Order> findByStatusAndCreateAtBefore(@Param("status") OrderStatus status, @Param("cutoffTime") Date cutoffTime);
    
    @Query("SELECT COUNT(o) > 0 FROM Order o " +
           "JOIN o.orderItems oi " +
           "WHERE o.user.id = :userId " +
           "AND oi.product.id = :productId " +
            "AND o.status = com.trash.ecommerce.entity.OrderStatus.FINISHED")
    boolean existsByUserIdAndProductIdAndStatusPaid(@Param("userId") Long userId, @Param("productId") Long productId);

        @Query("SELECT COUNT(DISTINCT o.id) FROM Order o " +
            "JOIN o.orderItems oi " +
            "WHERE o.user.id = :userId " +
            "AND oi.product.id = :productId " +
            "AND o.status = com.trash.ecommerce.entity.OrderStatus.FINISHED")
        long countFinishedOrdersByUserIdAndProductId(@Param("userId") Long userId, @Param("productId") Long productId);
}
