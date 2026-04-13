package com.trash.ecommerce.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplicationReviewRequestDTO {
    @NotBlank(message = "Hành động duyệt là bắt buộc")
    private String action;

    private String note;
}