package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ocop_registry_entries", indexes = {
        @Index(name = "idx_ocop_norm_product", columnList = "normalized_product_name"),
        @Index(name = "idx_ocop_norm_producer", columnList = "normalized_producer_name")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OcopRegistryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_name", nullable = false, length = 500)
    private String productName;

    @Column(name = "producer_name", nullable = false, length = 500)
    private String producerName;

    @Column(name = "normalized_product_name", nullable = false, length = 500)
    private String normalizedProductName;

    @Column(name = "normalized_producer_name", nullable = false, length = 500)
    private String normalizedProducerName;

    @Column(name = "province", length = 255)
    private String province;

    @Column(name = "ocop_stars")
    private Integer ocopStars;

    @Column(name = "source_url", length = 1000)
    private String sourceUrl;

    @Column(name = "last_synced_at", nullable = false)
    private LocalDateTime lastSyncedAt;
}
