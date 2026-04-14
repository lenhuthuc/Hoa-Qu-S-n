package com.trash.ecommerce.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.trash.ecommerce.entity.Product;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository <Product, Long> {
    @Query(
        value = " SELECT * FROM product " + 
        "WHERE product_name LIKE CONCAT('%', :name, '%') ",
        nativeQuery = true
    )
    Page<Product> findProductsByName(@Param("name") String name, PageRequest pageRequest);

    @Modifying
    @Query(value = "UPDATE product p SET quantity = p.quantity - :amount " +
            "WHERE p.id = :id AND p.quantity >= :amount",
            nativeQuery = true)
    int decreaseStock(@Param("id") Long id, @Param("amount") Long amount);

        @Modifying
        @Query(value = "UPDATE product p SET quantity = p.quantity + :amount WHERE p.id = :id",
            nativeQuery = true)
        int increaseStock(@Param("id") Long id, @Param("amount") Long amount);

    Page<Product> findByCategoryId(Long categoryId, PageRequest pageRequest);

    List<Product> findBySellerId(Long sellerId);

    List<Product> findByBatchId(String batchId);
}
