package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.ReturnStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReturnRequestDTO {
    private Long id;
    private Long orderId;
    private Long buyerId;
    private String buyerName;
    private Long sellerId;
    private String sellerName;
    private String reasonCode;
    private String description;
    private String evidenceUrls;
    private BigDecimal refundAmount;
    private ReturnStatus status;
    private String sellerResponse;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deadline;
}
