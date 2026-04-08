package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.FarmingLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FarmingLogRepository extends MongoRepository<FarmingLog, String> {

    List<FarmingLog> findByBatchIdOrderByCreatedAtAsc(String batchId);

    List<FarmingLog> findBySellerIdOrderByCreatedAtDesc(Long sellerId);

    List<FarmingLog> findBySellerIdAndBatchIdOrderByCreatedAtAsc(Long sellerId, String batchId);

    long countByBatchId(String batchId);
}
