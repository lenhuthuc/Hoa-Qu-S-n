package com.trash.ecommerce.entity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import jakarta.persistence.*;
import lombok.*;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "product")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    @Column(name = "id")
    private Long id;

    @Column(nullable = false, length = 500)
    private String productName;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "product", orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductImage> images = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "rating_count")
    private Integer ratingCount = 0;

    @Column(name = "rating", precision = 3, scale = 1)
    private BigDecimal rating = BigDecimal.ZERO;

    @Column(name = "quantity", nullable = false)
    private Long quantity = 100L;

    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;

    @Column(name = "batch_id", length = 50)
    private String batchId;

    @Column(name = "origin", length = 255)
    private String origin;

    @Column(name = "is_visible", nullable = false)
    private Boolean isVisible = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id")
    private Users seller;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "product")
    private Set<CartItem> cartItems = new HashSet<>();

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "product")
    private Set<InvoiceItem> invoiceItems = new HashSet<>();

    @OneToMany(fetch = FetchType.LAZY, mappedBy = "product", cascade = CascadeType.ALL)
    private List<Review> reviews = new ArrayList<>();

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "product")
    private Set<OrderItem> orderItems = new HashSet<>();

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "product")
    private Set<UserInteractions> userInteractions = new HashSet<>();

    /** Helper to get the primary image path */
    public String getPrimaryImagePath() {
        return images.stream()
                .filter(img -> Boolean.TRUE.equals(img.getIsPrimary()))
                .map(ProductImage::getImagePath)
                .findFirst()
                .orElse(images.isEmpty() ? null : images.get(0).getImagePath());
    }
}