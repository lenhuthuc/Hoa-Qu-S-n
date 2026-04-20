package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ReturnRequestCreateDTO;
import com.trash.ecommerce.dto.ReturnRequestDTO;

import java.util.List;

public interface ReturnService {
    ReturnRequestDTO createReturnRequest(Long buyerId, ReturnRequestCreateDTO dto);
    List<ReturnRequestDTO> getMyReturnRequests(Long userId);
    List<ReturnRequestDTO> getSellerReturnRequests(Long sellerId);
    ReturnRequestDTO sellerRespond(Long sellerId, Long returnId, String action, String response);
    ReturnRequestDTO buyerDecision(Long buyerId, Long returnId, String action);
    ReturnRequestDTO getReturnById(Long userId, Long returnId);
}
