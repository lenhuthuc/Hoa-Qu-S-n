package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.SellerApplication;
import com.trash.ecommerce.entity.SellerApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SellerApplicationRepository extends JpaRepository<SellerApplication, Long> {
    Optional<SellerApplication> findByUserId(Long userId);

    boolean existsByShopNameIgnoreCaseAndUserIdNot(String shopName, Long userId);

    List<SellerApplication> findAllByOrderBySubmittedAtDesc();

    List<SellerApplication> findByStatusOrderBySubmittedAtDesc(SellerApplicationStatus status);
}