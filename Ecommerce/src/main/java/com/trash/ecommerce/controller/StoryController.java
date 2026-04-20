package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Story;
import com.trash.ecommerce.entity.TraceabilityMilestone;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.StoryRepository;
import com.trash.ecommerce.repository.TraceabilityMilestoneRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.StorageService;
import com.trash.ecommerce.service.StoryMediaMetadataService;
import com.trash.ecommerce.service.TraceabilityBatchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
public class StoryController {

    private static final Set<String> IMAGE_MIME_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg", "image/jpg", "image/png"
    ));
    private static final Set<String> VIDEO_MIME_TYPES = new HashSet<>(List.of("video/mp4"));

    @Autowired
    private StoryRepository storyRepository;
    @Autowired
    private SellerApplicationRepository sellerApplicationRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private StorageService storageService;
    @Autowired
    private StoryMediaMetadataService metadataService;
    @Autowired
    private TraceabilityBatchService traceabilityBatchService;
    @Autowired
    private TraceabilityMilestoneRepository traceabilityMilestoneRepository;

    @GetMapping("/api/stories")
    public ResponseEntity<?> getPublicStories(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<Story> stories = storyRepository.findPublicActiveStoriesRanked(
                    LocalDateTime.now(),
                    PageRequest.of(page, size));
            List<Map<String, Object>> result = stories.getContent().stream().map(this::mapStory).toList();
            return ResponseEntity.ok(Map.of(
                    "stories", result,
                    "content", result,
                    "totalPages", stories.getTotalPages(),
                    "page", page,
                    "size", size
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/api/stories/seller/{sellerId}")
    public ResponseEntity<?> getSellerStories(@PathVariable Long sellerId) {
        try {
            List<Story> stories = storyRepository.findPublicActiveBySeller(sellerId, LocalDateTime.now());
            return ResponseEntity.ok(stories.stream().map(this::mapStory).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/api/seller/stories/my")
    public ResponseEntity<?> getMyStories(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
            if (!isSellerOrAdmin(seller)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Chỉ người bán mới có thể xem nhật ký"));
            }
            List<Story> stories = storyRepository.findBySellerIdOrderByCreatedAtDesc(userId);
            return ResponseEntity.ok(stories.stream().map(this::mapStory).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping(value = "/api/seller/stories", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @Transactional
    public ResponseEntity<?> createStory(
            @RequestHeader("Authorization") String token,
            @RequestPart("title") String title,
            @RequestPart("media") MultipartFile media,
            @RequestPart(value = "content", required = false) String content,
            @RequestPart(value = "activityType", required = false) String activityType,
            @RequestPart(value = "batchId", required = false) String batchId) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
            if (!isSellerOrAdmin(seller)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Chỉ người bán mới được đăng nhật ký"));
            }

            if (title == null || title.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Tiêu đề là bắt buộc"));
            }
            if (title.length() > 120) {
                return ResponseEntity.badRequest().body(Map.of("message", "Tiêu đề không được vượt quá 120 ký tự"));
            }

            if (media == null || media.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Vui lòng chọn 1 ảnh hoặc 1 video"));
            }

            String contentType = media.getContentType() == null ? "" : media.getContentType().toLowerCase();
            String mediaType;
            StoryMediaMetadataService.StoryMediaAnalysis analysis;

            if (IMAGE_MIME_TYPES.contains(contentType)) {
                mediaType = "IMAGE";
                analysis = metadataService.analyzeImage(media);
            } else if (VIDEO_MIME_TYPES.contains(contentType)) {
                mediaType = "VIDEO";
                analysis = metadataService.analyzeVideo(media);

                Double duration = analysis.durationSeconds();
                if (duration == null || duration < 10 || duration > 30) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Video phải có thời lượng từ 10 đến 30 giây"));
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "Chỉ hỗ trợ JPG/PNG hoặc MP4"));
            }

            String uploadedUrl = storageService.uploadReviewMedia(userId, media, mediaType.equals("IMAGE") ? "image" : "video");
            String normalizedMediaUrl = resolveMediaUrlForClient(uploadedUrl);

            String normalizedBatchId = null;
            if (batchId != null && !batchId.trim().isBlank()) {
                normalizedBatchId = batchId.trim();
                traceabilityBatchService.requireOwnedBatch(normalizedBatchId, userId);
            }

            Story story = new Story();
            story.setSeller(seller);
            story.setTitle(title.trim());
            story.setContent(content == null ? "" : content.trim());
            story.setActivityType(activityType == null ? null : activityType.trim());
            story.setBatchId(normalizedBatchId);

            story.setMediaType(mediaType);
            story.setMediaUrl(uploadedUrl);
            story.setImageUrl(mediaType.equals("IMAGE") ? uploadedUrl : null);
            story.setVideoUrl(mediaType.equals("VIDEO") ? uploadedUrl : null);

            story.setLatitude(analysis.latitude());
            story.setLongitude(analysis.longitude());
            story.setCapturedAt(analysis.capturedAt() != null ? analysis.capturedAt() : LocalDateTime.now());
            story.setHasAudio(mediaType.equals("VIDEO") ? Boolean.TRUE.equals(analysis.hasAudio()) : null);
            story.setMetadataMissing(analysis.metadataMissing());
            story.setExpiresAt(LocalDateTime.now().plusHours(24));

            storyRepository.save(story);

            if (normalizedBatchId != null) {
                TraceabilityMilestone milestone = new TraceabilityMilestone();
                milestone.setBatchId(normalizedBatchId);
                milestone.setStoryId(story.getId());
                milestone.setSellerId(userId);
                milestone.setTitle(story.getTitle());
                milestone.setNote(story.getContent());
                milestone.setActivityType(story.getActivityType());
                milestone.setMediaUrl(uploadedUrl);
                milestone.setMediaType(story.getMediaType());
                milestone.setCapturedAt(story.getCapturedAt());
                milestone.setGpsLat(story.getLatitude());
                milestone.setGpsLng(story.getLongitude());
                milestone.setMetadataMissing(story.getMetadataMissing());
                milestone.setHasAudio(story.getHasAudio());
                traceabilityMilestoneRepository.save(milestone);
            }

            Map<String, Object> response = mapStory(story);
            response.put("mediaUrl", normalizedMediaUrl);
            response.put("imageUrl", mediaType.equals("IMAGE") ? normalizedMediaUrl : null);
            response.put("videoUrl", mediaType.equals("VIDEO") ? normalizedMediaUrl : null);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/api/seller/stories/{id}")
    public ResponseEntity<?> deleteStory(
            @RequestHeader("Authorization") String token,
            @PathVariable Long id) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
            if (!isSellerOrAdmin(seller)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Chỉ người bán mới được xoá nhật ký"));
            }

            Story story = storyRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy nhật ký"));
            if (!story.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Không có quyền truy cập"));
            }
            storyRepository.delete(story);
            return ResponseEntity.ok(Map.of("message", "Đã xóa"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private Map<String, Object> mapStory(Story s) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", s.getId());
        map.put("sellerId", s.getSeller().getId());
        String shopName = resolveShopName(s.getSeller());
        map.put("sellerName", shopName);
        map.put("shopName", shopName);
        map.put("title", s.getTitle());
        map.put("content", s.getContent());
        String normalizedMediaUrl = resolveMediaUrlForClient(s.getMediaUrl() != null ? s.getMediaUrl() : (s.getImageUrl() != null ? s.getImageUrl() : s.getVideoUrl()));
        map.put("mediaUrl", normalizedMediaUrl);
        map.put("mediaType", s.getMediaType() != null ? s.getMediaType() : (s.getVideoUrl() != null ? "VIDEO" : "IMAGE"));
        map.put("imageUrl", ("VIDEO".equalsIgnoreCase(s.getMediaType()) ? null : normalizedMediaUrl));
        map.put("videoUrl", ("VIDEO".equalsIgnoreCase(s.getMediaType()) ? normalizedMediaUrl : null));
        map.put("batchId", s.getBatchId());
        map.put("activityType", s.getActivityType());
        map.put("likesCount", s.getLikesCount());
        map.put("latitude", s.getLatitude());
        map.put("longitude", s.getLongitude());
        map.put("capturedAt", s.getCapturedAt());
        map.put("expiresAt", s.getExpiresAt());
        map.put("metadataMissing", s.getMetadataMissing());
        map.put("hasAudio", s.getHasAudio());
        map.put("createdAt", s.getCreatedAt());
        return map;
    }

    private String resolveShopName(Users seller) {
        if (seller == null || seller.getId() == null) {
            return "Nông hộ";
        }

        return sellerApplicationRepository.findByUserId(seller.getId())
                .map(app -> app.getShopName() != null && !app.getShopName().isBlank() ? app.getShopName().trim() : null)
                .orElseGet(() -> {
                    if (seller.getFullName() != null && !seller.getFullName().isBlank()) {
                        return seller.getFullName().trim();
                    }
                    if (seller.getUsername() != null && !seller.getUsername().isBlank()) {
                        return seller.getUsername().trim();
                    }
                    return "Nông hộ";
                });
    }

    private boolean isSellerOrAdmin(Users user) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        return user.getRoles().stream().anyMatch(role -> {
            String name = role.getRoleName();
            return "SELLER".equalsIgnoreCase(name) || "ADMIN".equalsIgnoreCase(name);
        });
    }

    private String resolveMediaUrlForClient(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }

        String value = rawUrl.trim();
        if (value.startsWith("/api/reviews/media")) {
            return value;
        }
        if (value.contains(".r2.cloudflarestorage.com/") || value.startsWith("local:") || value.startsWith("review-media/") || value.startsWith("reviews/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        return value;
    }
}
