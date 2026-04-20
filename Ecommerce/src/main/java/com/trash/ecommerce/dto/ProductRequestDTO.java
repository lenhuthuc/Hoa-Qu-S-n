package com.trash.ecommerce.dto;

import java.math.BigDecimal;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
@AllArgsConstructor
@NoArgsConstructor
@Data
public class ProductRequestDTO {
    @NotNull
    private String productName;
    @NotNull
    private BigDecimal price;
    private Long quantity;
    private Long unitWeightGrams;
    private BigDecimal totalStockWeightKg;
    private Integer shelfLifeDays;
    private Long categoryId;
    private String description;
    private String batchId;
    private String origin;
    private Boolean publishToFacebook;
    private String facebookPageId;
}

