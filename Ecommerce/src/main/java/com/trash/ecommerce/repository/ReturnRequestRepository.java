package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.ReturnRequest;
import com.trash.ecommerce.entity.ReturnStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReturnRequestRepository extends JpaRepository<ReturnRequest, Long> {
    List<ReturnRequest> findByBuyerIdOrderByCreatedAtDesc(Long buyerId);
    List<ReturnRequest> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
    List<ReturnRequest> findByStatusOrderByCreatedAtDesc(ReturnStatus status);
    List<ReturnRequest> findByOrderId(Long orderId);
    boolean existsByOrderId(Long orderId);
    Integer countBySellerIdAndStatus(Long sellerId, ReturnStatus status);
}
