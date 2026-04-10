package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.AgriCoin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgriCoinRepository extends JpaRepository<AgriCoin, Long> {
    Optional<AgriCoin> findByUserId(Long userId);
}
