package com.trash.ecommerce.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class BatchResponseDTO {
    private String batchId;
    private String batchName;
    private String cropType;
    private LocalDate startDate;
    private String status;
    private String qrCodeValue;
    private String qrCodeUrl;
    private LocalDateTime createdAt;
}
