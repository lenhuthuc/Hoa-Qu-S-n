package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.SellerDashboardDTO;

public interface SellerDashboardService {
    SellerDashboardDTO getDashboard(Long sellerId);
}
