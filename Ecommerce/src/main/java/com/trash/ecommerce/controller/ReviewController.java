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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

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

            if (images != null && images.size() > 2) {
                throw new IllegalArgumentException("Tối đa 2 ảnh cho mỗi đánh giá");
            }
            if (video != null && !video.isEmpty() && video.getContentType() != null && !video.getContentType().startsWith("video/")) {
                throw new IllegalArgumentException("Video tải lên không hợp lệ");
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
        Files.write(target, file.getBytes());
        return "/api/reviews/media/" + filename;
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
}