package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product_images")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "image_path", nullable = false, length = 1000)
    private String imagePath;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "is_primary")
    private Boolean isPrimary = false;
}
