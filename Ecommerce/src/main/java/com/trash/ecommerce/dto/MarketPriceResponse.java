package com.trash.ecommerce.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketPriceResponse {
    private Long id;
    private String productName;
    private String category;
    private String region;
    private Double avgPrice;
    private Double minPrice;
    private Double maxPrice;
    private String unit;
    private String source;
}
