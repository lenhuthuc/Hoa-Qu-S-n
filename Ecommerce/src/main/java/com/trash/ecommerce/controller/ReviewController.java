package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.ReviewRequest;
import com.trash.ecommerce.dto.ReviewResponse;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.ReviewService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaTypeFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {
    private static final int MAX_IMAGE_COUNT = 2;
    private static final int MAX_COMMENT_LENGTH = 1000;
    private static final long MAX_IMAGE_SIZE_BYTES = 5L * 1024 * 1024;  // 5MB
    private static final long MAX_VIDEO_SIZE_BYTES = 25L * 1024 * 1024; // 25MB
    private static final long MAX_TOTAL_SIZE_BYTES = 30L * 1024 * 1024; // 30MB
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");
    private static final Set<String> ALLOWED_VIDEO_CONTENT_TYPES = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-m4v");
    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS = Set.of("mp4", "webm", "mov", "m4v");


    private Logger logger = LoggerFactory.getLogger(ReviewController.class);
    @Autowired
    private ReviewService reviewService;
    @Autowired
    private JwtService jwtService;

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
                    validateMediaFile(image, true);
                    totalUploadBytes += image.getSize();
                }
            }
            if (video != null && !video.isEmpty()) {
                validateMediaFile(video, false);
                totalUploadBytes += video.getSize();
            }
            if (totalUploadBytes > MAX_TOTAL_SIZE_BYTES) {
                throw new IllegalArgumentException("Tổng dung lượng tệp đính kèm không được vượt quá 30MB");
            }

            List<String> mediaUrls = new ArrayList<>();
            if (images != null) {
                for (MultipartFile image : images) {
                    if (image != null && !image.isEmpty()) {
                        mediaUrls.add(saveReviewMedia(image, "image"));
                    }
                }
            }
            if (video != null && !video.isEmpty()) {
                mediaUrls.add(saveReviewMedia(video, "video"));
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
            Path mediaDir = Paths.get("uploads/reviews");
            Path filePath = mediaDir.resolve(filename).normalize();
            if (!filePath.startsWith(mediaDir) || !Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            MediaType mediaType = MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM);
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private String saveReviewMedia(MultipartFile file, String prefix) throws IOException {
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename().replaceAll("[\\\\/:*?\"<>|]", "_") : "file";
        String filename = System.currentTimeMillis() + "_" + prefix + "_" + originalName;
        Path uploadDir = Paths.get("uploads/reviews");
        Files.createDirectories(uploadDir);
        Path target = uploadDir.resolve(filename);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return "/api/reviews/media/" + filename;
    }

    private void validateMediaFile(MultipartFile file, boolean isImage) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Tệp tải lên không hợp lệ");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new IllegalArgumentException("Tên tệp không hợp lệ");
        }

        String normalizedName = originalName.trim().toLowerCase();
        if (normalizedName.contains("..") || normalizedName.contains("/") || normalizedName.contains("\\")) {
            throw new IllegalArgumentException("Tên tệp chứa ký tự không hợp lệ");
        }

        String extension = getFileExtension(normalizedName);
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

        if (isImage) {
            if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension) || !ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Ảnh tải lên không hợp lệ. Chỉ hỗ trợ JPG, PNG, WEBP, GIF");
            }
            if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
                throw new IllegalArgumentException("Mỗi ảnh không được vượt quá 5MB");
            }
        } else {
            if (!ALLOWED_VIDEO_EXTENSIONS.contains(extension) || !ALLOWED_VIDEO_CONTENT_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("Video tải lên không hợp lệ. Chỉ hỗ trợ MP4, WEBM, MOV, M4V");
            }
            if (file.getSize() > MAX_VIDEO_SIZE_BYTES) {
                throw new IllegalArgumentException("Video không được vượt quá 25MB");
            }
        }
    }

    private String getFileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1);
    }

    @DeleteMapping("/products/{productId}/{reviewId}")
    public ResponseEntity<?> deleteReview(
            @RequestHeader("Authorization") String token,
            @PathVariable Long productId,
            @PathVariable Long reviewId) {
        try {
            Long userId = jwtService.extractId(token);
            reviewService.deleteComment(userId, productId, reviewId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("deleteReview has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi xóa đánh giá"));
        }
    }

    @GetMapping("/products/{productId}")
    public ResponseEntity<?> getProductReviews(@PathVariable Long productId) {
        try {
            List<ReviewResponse> reviews = reviewService.findReviewByProductId(productId);
            return ResponseEntity.ok(reviews);
        } catch (Exception e) {
            logger.error("getProductReviews has errors", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi lấy đánh giá"));
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
}