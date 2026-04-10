package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.OcopRegistryEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OcopRegistryEntryRepository extends JpaRepository<OcopRegistryEntry, Long> {
    Optional<OcopRegistryEntry> findFirstByNormalizedProductNameAndNormalizedProducerName(String normalizedProductName, String normalizedProducerName);
    List<OcopRegistryEntry> findTop20ByNormalizedProductNameContainingOrderByLastSyncedAtDesc(String normalizedProductName);
}
