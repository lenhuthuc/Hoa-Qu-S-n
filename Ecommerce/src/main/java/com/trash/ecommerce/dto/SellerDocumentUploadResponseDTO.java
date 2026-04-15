package com.trash.ecommerce.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellerDocumentUploadResponseDTO {
    private String idCardFrontUrl;
    private String idCardBackUrl;
    private String businessLicenseUrl;
    private String foodSafetyDocumentUrl;
}
