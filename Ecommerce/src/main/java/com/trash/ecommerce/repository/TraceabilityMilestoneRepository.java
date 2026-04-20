package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.TraceabilityMilestone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TraceabilityMilestoneRepository extends JpaRepository<TraceabilityMilestone, Long> {
    List<TraceabilityMilestone> findByBatchIdOrderByCreatedAtAsc(String batchId);

    long countByBatchId(String batchId);
}
