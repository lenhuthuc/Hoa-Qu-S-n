package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.SellerApplicationResponseDTO;
import com.trash.ecommerce.dto.SellerApplicationSubmitRequestDTO;

import java.util.List;

public interface SellerApplicationService {
    SellerApplicationResponseDTO submit(Long userId, SellerApplicationSubmitRequestDTO request);

    SellerApplicationResponseDTO getMine(Long userId);

    List<SellerApplicationResponseDTO> getAll(String status);

    SellerApplicationResponseDTO startReview(Long adminId, Long applicationId);

    SellerApplicationResponseDTO review(Long adminId, Long applicationId, String action, String note);
}