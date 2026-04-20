package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.FarmingBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FarmingBatchRepository extends JpaRepository<FarmingBatch, Long> {
    Optional<FarmingBatch> findByBatchId(String batchId);

    Optional<FarmingBatch> findByBatchIdAndSellerId(String batchId, Long sellerId);

    List<FarmingBatch> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
}
