package com.trash.ecommerce.mapper;

import com.trash.ecommerce.dto.ReviewRequest;
import com.trash.ecommerce.dto.ReviewResponse;
import com.trash.ecommerce.entity.Review;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Component
public class ReviewsMapper {
    @Autowired
    private UserRepository userRepository;
    public ReviewResponse mapReview (Review review) {
        Users users = userRepository.findById(review.getUser().getId()).get();
        ReviewResponse response = new ReviewResponse();
        response.setReviewId(review.getId());
        response.setUserId(users.getId());
        response.setReviewerName(users.getFullName() != null ? users.getFullName() : users.getUsername());
        response.setProductId(review.getProduct().getId());
        response.setRating(review.getRating());
        response.setContent(review.getContent());
        response.setMediaUrls(parseMediaUrls(review.getMediaUrls()));
        response.setCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt().toString() : null);
        return response;
    }

    public Review mapReviewDTO (ReviewRequest review) {
        Review review1 = new Review();
        review1.setRating(review.getRating());
        review1.setContent(review.getContent());
        if (review.getMediaUrls() != null && !review.getMediaUrls().isEmpty()) {
            review1.setMediaUrls(String.join(",", review.getMediaUrls()));
        }
        return review1;
    }

    private List<String> parseMediaUrls(String mediaUrls) {
        if (mediaUrls == null || mediaUrls.isBlank()) return Collections.emptyList();
        return Arrays.asList(mediaUrls.split(","));
    }
}
