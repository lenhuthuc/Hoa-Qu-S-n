package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "market_prices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_name", nullable = false, length = 100)
    private String productName;

    @Column(length = 50)
    private String category;

    @Column(length = 50)
    private String region;

    @Column(name = "avg_price")
    private Double avgPrice;

    @Column(name = "min_price")
    private Double minPrice;

    @Column(name = "max_price")
    private Double maxPrice;

    @Column(length = 20)
    private String unit;

    @Column(length = 100)
    private String source;
}
