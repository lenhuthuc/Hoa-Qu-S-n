package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.ReviewRequest;
import com.trash.ecommerce.dto.ReviewResponse;
import com.trash.ecommerce.entity.NotificationType;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.Review;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.exception.FindingUserError;
import com.trash.ecommerce.exception.ProductFingdingException;
import com.trash.ecommerce.exception.ReviewException;
import com.trash.ecommerce.mapper.ReviewsMapper;
import com.trash.ecommerce.repository.OrderRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.ReviewRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ReviewServiceImpl implements ReviewService {
    private static final int MAX_COMMENT_LENGTH = 1000;
    private static final int MAX_MEDIA_ITEMS = 3;

    @Autowired
    private ReviewsMapper reviewsMapper;
    @Autowired
    private ReviewRepository reviewRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private AgriCoinService agriCoinService;
    @Autowired
    private TrustScoreService trustScoreService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private EventPublisher eventPublisher;
    @Override
    public ReviewResponse createComment(Long userId, Long productId, ReviewRequest reviewRequest) {
        validateReviewRequest(reviewRequest);
        
        Review review = reviewsMapper.mapReviewDTO(reviewRequest);
        Users users = userRepository.findById(userId)
                .orElseThrow(() -> new FindingUserError("User not found"));
        Product product = productRepository.findById(productId)
                        .orElseThrow(() -> new ProductFingdingException("Product not found"));
        
        Map<String, Object> eligibility = getReviewEligibility(userId, productId);
        boolean canReview = Boolean.TRUE.equals(eligibility.get("canReview"));
        if (!canReview) {
            long finishedOrderCount = (long) eligibility.getOrDefault("finishedOrderCount", 0L);
            if (finishedOrderCount <= 0) {
                throw new ReviewException("Bạn chỉ có thể đánh giá sản phẩm đã mua!");
            }
            throw new ReviewException("Bạn đã dùng hết lượt đánh giá cho sản phẩm này");
        }

        long finishedOrderCount = (long) eligibility.getOrDefault("finishedOrderCount", 0L);
        if (finishedOrderCount <= 0) {
            throw new ReviewException("Bạn chỉ có thể đánh giá sản phẩm đã mua!");
        }

        if (users.getReviews() == null) {
            users.setReviews(new ArrayList<>());
        }
        users.getReviews().add(review);
        if (product.getReviews() == null) {
            product.setReviews(new ArrayList<>());
        }
        product.getReviews().add(review);
        review.setUser(users);
        review.setProduct(product);
        reviewRepository.save(review);
        // Trigger sẽ tự động cập nhật rating, nhưng ta refresh product để đảm bảo
        productRepository.flush();
        // Award AgriCoin for review
        try {
            agriCoinService.reward(userId, 10, "REVIEW_REWARD", "Thưởng đánh giá sản phẩm: " + product.getProductName(), review.getId());
        } catch (Exception ignored) {}

        // Recalculate seller trust score and notify seller
        if (product.getSeller() != null) {
            Long sellerId = product.getSeller().getId();
            trustScoreService.recalculateTrustScore(sellerId);
            notificationService.send(sellerId,
                    "Đánh giá mới",
                    users.getFullName() + " đã đánh giá " + reviewRequest.getRating() + "⭐ cho " + product.getProductName(),
                    NotificationType.REVIEW_RECEIVED,
                    review.getId());
            eventPublisher.publishNotification(sellerId,
                    "Đánh giá mới", "REVIEW_RECEIVED", review.getId());
        }

        return reviewsMapper.mapReview(review);
    }

    private void validateReviewRequest(ReviewRequest reviewRequest) {
        if (reviewRequest == null) {
            throw new IllegalArgumentException("Review request cannot be null");
        }
        if (reviewRequest.getRating() == null || reviewRequest.getRating() < 1 || reviewRequest.getRating() > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5");
        }

        String content = reviewRequest.getContent() != null ? reviewRequest.getContent().trim() : "";
        if (content.isBlank()) {
            throw new IllegalArgumentException("Nội dung đánh giá không được để trống");
        }
        if (content.length() > MAX_COMMENT_LENGTH) {
            throw new IllegalArgumentException("Nội dung đánh giá không được vượt quá " + MAX_COMMENT_LENGTH + " ký tự");
        }

        if (reviewRequest.getMediaUrls() != null && reviewRequest.getMediaUrls().size() > MAX_MEDIA_ITEMS) {
            throw new IllegalArgumentException("Tối đa " + MAX_MEDIA_ITEMS + " tệp đính kèm cho mỗi đánh giá");
        }

        reviewRequest.setContent(content);
    }

    @Override
    public void deleteComment(Long userId, Long productId, Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ReviewException("review not found"));
        if (review.getUser() == null || review.getProduct() == null) {
            throw new ReviewException("Review is missing user or product information");
        }
        if(Objects.equals(review.getUser().getId(), userId) && Objects.equals(review.getProduct().getId(), productId)) {
            reviewRepository.deleteById(reviewId);
            // Trigger sẽ tự động cập nhật rating sau khi xóa review
            productRepository.flush();
        } else {
            throw new AccessDeniedException("You do not have permission to delete this review");
        }
    }

    @Override
    public List<ReviewResponse> findReviewByProductId(Long productId) {
        List<ReviewResponse> reviews = reviewRepository.findByProductId(productId)
                .stream()
                .map(review -> (ReviewResponse) reviewsMapper.mapReview(review))
                .toList();
        return reviews;
    }

    @Override
    public Map<String, Object> getReviewEligibility(Long userId, Long productId) {
        long finishedOrderCount = orderRepository.countFinishedOrdersByUserIdAndProductId(userId, productId);
        long reviewedCount = reviewRepository.countByUserIdAndProductId(userId, productId);
        long remainingReviews = Math.max(0L, finishedOrderCount - reviewedCount);

        return Map.of(
                "finishedOrderCount", finishedOrderCount,
                "reviewedCount", reviewedCount,
                "remainingReviews", remainingReviews,
                "canReview", remainingReviews > 0
        );
    }
}
