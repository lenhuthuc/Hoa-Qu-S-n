package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.SellerType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplicationResponseDTO {
    private Long id;
    private Long userId;
    private String userEmail;

    private String shopName;
    private String contactEmail;
    private String contactPhone;
    private String pickupAddress;
    private String pickupProvince;
    private String pickupDistrict;
    private String pickupWard;
    private String pickupStreetDetail;
    private Integer pickupGhnProvinceId;
    private Integer pickupGhnDistrictId;
    private String pickupGhnWardCode;
    private String shippingProvider;

    private SellerType sellerType;
    private String taxCode;
    private String businessName;
    private String businessAddress;
    private String businessLicenseUrl;

    private String identityFullName;
    private String identityNumber;
    private LocalDate identityIssueDate;
    private String identityIssuePlace;
    private String idCardFrontUrl;
    private String idCardBackUrl;
    private Boolean agreedToTerms;

    private String status;
    private String reviewNote;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}