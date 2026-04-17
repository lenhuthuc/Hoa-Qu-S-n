package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ReviewRequest;
import com.trash.ecommerce.dto.ReviewResponse;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.ReviewService;
import com.trash.ecommerce.service.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {
    private static final int MAX_IMAGE_COUNT = 2;
    private static final int MAX_COMMENT_LENGTH = 1000;
    private static final long MAX_TOTAL_SIZE_BYTES = 30L * 1024 * 1024; // 30MB total

    private Logger logger = LoggerFactory.getLogger(ReviewController.class);
    @Autowired
    private ReviewService reviewService;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private StorageService storageService;

    @PostMapping("/products/{productId}")
    public ResponseEntity<?> createReview(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId,
            @RequestBody ReviewRequest reviewRequest) {
        try {
            Long userId = jwtService.extractId(token);
            ReviewResponse response = reviewService.createComment(userId, productId, reviewRequest);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("createReview has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi tạo đánh giá"));
        }
    }

    @PostMapping(value = "/products/{productId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createReviewWithAttachments(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId,
            @RequestParam Integer rating,
            @RequestParam String comment,
            @RequestPart(value = "images", required = false) List<MultipartFile> images,
            @RequestPart(value = "video", required = false) MultipartFile video) {
        try {
            Long userId = jwtService.extractId(token);

            if (rating == null || rating < 1 || rating > 5) {
                throw new IllegalArgumentException("Điểm đánh giá phải nằm trong khoảng từ 1 đến 5");
            }

            if (comment == null || comment.trim().isEmpty()) {
                throw new IllegalArgumentException("Nội dung đánh giá không được để trống");
            }
            comment = comment.trim();
            if (comment.length() > MAX_COMMENT_LENGTH) {
                throw new IllegalArgumentException("Nội dung đánh giá không được vượt quá " + MAX_COMMENT_LENGTH + " ký tự");
            }

            if (images != null && images.size() > MAX_IMAGE_COUNT) {
                throw new IllegalArgumentException("Tối đa " + MAX_IMAGE_COUNT + " ảnh cho mỗi đánh giá");
            }

            long totalUploadBytes = 0L;
            if (images != null) {
                for (MultipartFile image : images) {
                    totalUploadBytes += image.getSize();
                }
            }
            if (video != null && !video.isEmpty()) {
                totalUploadBytes += video.getSize();
            }
            if (totalUploadBytes > MAX_TOTAL_SIZE_BYTES) {
                throw new IllegalArgumentException("Tổng dung lượng tệp đính kèm không được vượt quá 30MB");
            }

            List<String> mediaUrls = new ArrayList<>();
            if (images != null) {
                for (MultipartFile image : images) {
                    if (image != null && !image.isEmpty()) {
                        try {
                            String url = storageService.uploadReviewMedia(userId, image, "image");
                            mediaUrls.add(url);
                        } catch (IOException e) {
                            throw new RuntimeException("Lỗi tải ảnh: " + e.getMessage());
                        }
                    }
                }
            }
            if (video != null && !video.isEmpty()) {
                try {
                    String url = storageService.uploadReviewMedia(userId, video, "video");
                    mediaUrls.add(url);
                } catch (IOException e) {
                    throw new RuntimeException("Lỗi tải video: " + e.getMessage());
                }
            }

            ReviewRequest reviewRequest = new ReviewRequest();
            reviewRequest.setRating(rating);
            reviewRequest.setContent(comment);
            reviewRequest.setMediaUrls(mediaUrls);

            ReviewResponse response = reviewService.createComment(userId, productId, reviewRequest);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("createReviewWithAttachments has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi tạo đánh giá"));
        }
    }

    @GetMapping("/media/{filename}")
    public ResponseEntity<Resource> getReviewMedia(@PathVariable String filename) {
        try {
            String mediaUrl = normalizeMediaUrlForRead(filename);
            StorageService.DocumentFile docFile = storageService.downloadReviewMedia(mediaUrl);
            
            Resource resource = new org.springframework.core.io.ByteArrayResource(docFile.content());
            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.parseMediaType(docFile.contentType()))
                    .header("Content-Disposition", "inline; filename=\"" + docFile.fileName() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/media")
    public ResponseEntity<Resource> getReviewMediaByUrl(@RequestParam("url") String mediaUrl) {
        try {
            String normalizedMediaUrl = normalizeMediaUrlForRead(mediaUrl);
            StorageService.DocumentFile docFile = storageService.downloadReviewMedia(normalizedMediaUrl);

            Resource resource = new ByteArrayResource(docFile.content());
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(docFile.contentType()))
                    .header("Content-Disposition", "inline; filename=\"" + docFile.fileName() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private String normalizeMediaUrlForRead(String rawMediaUrl) {
        if (rawMediaUrl == null || rawMediaUrl.isBlank()) {
            throw new IllegalArgumentException("Thiếu URL media");
        }

        String mediaUrl = rawMediaUrl.trim();

        // Legacy URLs saved as /api/reviews/media/{filename}
        String marker = "/api/reviews/media/";
        int markerIndex = mediaUrl.indexOf(marker);
        if (markerIndex >= 0) {
            mediaUrl = mediaUrl.substring(markerIndex + marker.length());
        }

        if (mediaUrl.startsWith("local:") || mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
            return mediaUrl;
        }

        // Local object key style (new or legacy explicit)
        if (mediaUrl.startsWith("review-media/") || mediaUrl.startsWith("reviews/")) {
            return "local:" + mediaUrl;
        }

        // Legacy plain filename -> uploads/reviews/{filename}
        return "local:reviews/" + mediaUrl;
    }

    @GetMapping("/products/{productId}")
    public ResponseEntity<?> findReviewByProduct(@PathVariable Long productId) {
        try {
            return ResponseEntity.ok(reviewService.findReviewByProductId(productId));
        } catch (Exception e) {
            logger.error("findReviewByProduct has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi lấy đánh giá sản phẩm"));
        }
    }

    @GetMapping("/products/{productId}/eligibility")
    public ResponseEntity<?> getReviewEligibility(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId) {
        try {
            Long userId = jwtService.extractId(token);
            return ResponseEntity.ok(reviewService.getReviewEligibility(userId, productId));
        } catch (Exception e) {
            logger.error("getReviewEligibility has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi kiểm tra quyền đánh giá"));
        }
    }

    @DeleteMapping("/products/{productId}/{reviewId}")
    public ResponseEntity<?> deleteReview(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId,
            @PathVariable Long reviewId) {
        try {
            Long userId = jwtService.extractId(token);
            reviewService.deleteComment(userId, productId, reviewId);
            return ResponseEntity.ok(Map.of("message", "Xóa đánh giá thành công"));
        } catch (Exception e) {
            logger.error("deleteReview has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi xóa đánh giá"));
        }
    }
}