package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.TrustScoreDTO;

public interface TrustScoreService {
    TrustScoreDTO getTrustScore(Long sellerId);
    TrustScoreDTO recalculateTrustScore(Long sellerId);
}
