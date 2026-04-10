package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.Story;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoryRepository extends JpaRepository<Story, Long> {
    Page<Story> findByIsPublishedTrueOrderByCreatedAtDesc(Pageable pageable);
    List<Story> findBySellerIdAndIsPublishedTrueOrderByCreatedAtDesc(Long sellerId);
    List<Story> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
    List<Story> findByBatchIdOrderByCreatedAtDesc(String batchId);
}
