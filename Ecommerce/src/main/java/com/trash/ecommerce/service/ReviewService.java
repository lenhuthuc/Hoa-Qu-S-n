package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ReviewRequest;
import com.trash.ecommerce.dto.ReviewResponse;

import java.util.List;
import java.util.Map;

public interface ReviewService {
    public ReviewResponse createComment(Long userId, Long productId, ReviewRequest review);
    public void deleteComment(Long userId, Long productId, Long reviewId);
    public List<ReviewResponse> findReviewByProductId(Long productId);
    public Map<String, Object> getReviewEligibility(Long userId, Long productId);
}
