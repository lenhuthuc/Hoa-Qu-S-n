package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {

    @Query("SELECT m FROM MarketPrice m WHERE LOWER(m.productName) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<MarketPrice> searchByName(@Param("name") String name);

    Optional<MarketPrice> findFirstByProductNameIgnoreCase(String productName);

    List<MarketPrice> findByCategory(String category);
}
