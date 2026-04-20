package com.trash.ecommerce.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class BatchCreateRequestDTO {
    private String batchName;
    private String cropType;
    private LocalDate startDate;
}
