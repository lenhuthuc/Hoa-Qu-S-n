package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.CoinTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CoinTransactionRepository extends JpaRepository<CoinTransaction, Long> {
    Page<CoinTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
