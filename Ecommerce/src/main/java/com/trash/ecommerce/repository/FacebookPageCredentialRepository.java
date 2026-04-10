package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.FacebookPageCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FacebookPageCredentialRepository extends JpaRepository<FacebookPageCredential, Long> {
    Optional<FacebookPageCredential> findBySellerIdAndPageId(Long sellerId, String pageId);
    List<FacebookPageCredential> findBySellerIdOrderByTokenLastUpdatedAtDesc(Long sellerId);
}
