package com.trash.ecommerce.dto;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class ProductDetailsResponseDTO {
    private Long id;
    @JsonProperty("productName")
    private String product_name;
    private BigDecimal price;
    private Long quantity;
    private Long unitWeightGrams;
    private BigDecimal totalStockWeightKg;
    private Long categoryId;
    private String categoryName;
    private String description;
    @JsonProperty("imageUrl")
    private String image;
    private List<String> imageUrls;
    private Integer ratingCount;
    private Double rating;
    private Long sellerId;
    private String sellerName;
    private String shopName;
    private String shopAvatar;
    private String batchId;
    private String origin;
}

