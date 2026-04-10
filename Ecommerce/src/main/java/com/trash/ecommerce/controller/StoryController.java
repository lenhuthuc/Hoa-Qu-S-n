package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Story;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.dto.FarmingLogRequest;
import com.trash.ecommerce.repository.StoryRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.service.FarmingJournalService;
import com.trash.ecommerce.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stories")
public class StoryController {

    @Autowired
    private StoryRepository storyRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private FarmingJournalService farmingJournalService;

    @GetMapping
    public ResponseEntity<?> getPublicStories(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<Story> stories = storyRepository.findByIsPublishedTrueOrderByCreatedAtDesc(
                    PageRequest.of(page, size));
            List<Map<String, Object>> result = stories.getContent().stream().map(this::mapStory).toList();
            return ResponseEntity.ok(Map.of("stories", result, "totalPages", stories.getTotalPages()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/seller/{sellerId}")
    public ResponseEntity<?> getSellerStories(@PathVariable Long sellerId) {
        try {
            List<Story> stories = storyRepository.findBySellerIdAndIsPublishedTrueOrderByCreatedAtDesc(sellerId);
            return ResponseEntity.ok(stories.stream().map(this::mapStory).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-stories")
    public ResponseEntity<?> getMyStories(@RequestHeader("Authorization") String token) {
        try {
            Long userId = jwtService.extractId(token);
            List<Story> stories = storyRepository.findBySellerIdOrderByCreatedAtDesc(userId);
            return ResponseEntity.ok(stories.stream().map(this::mapStory).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createStory(
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, String> body) {
        try {
            Long userId = jwtService.extractId(token);
            Users seller = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            Story story = new Story();
            story.setSeller(seller);
            story.setTitle(body.getOrDefault("title", ""));
            story.setContent(body.getOrDefault("content", ""));
            story.setImageUrl(body.get("imageUrl"));
            story.setVideoUrl(body.get("videoUrl"));
            story.setBatchId(body.get("batchId"));
            story.setFarmingLogId(body.get("farmingLogId"));
            story.setActivityType(body.get("activityType"));

            if (story.getTitle().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("message", "Title is required"));
            }

            storyRepository.save(story);

            // Auto-create farming log entry when story has batchId
            if (story.getBatchId() != null && !story.getBatchId().isBlank()) {
                try {
                    FarmingLogRequest logReq = new FarmingLogRequest();
                    logReq.setBatchId(story.getBatchId());
                    logReq.setNote(story.getTitle() + ": " + story.getContent());
                    logReq.setActivityType(story.getActivityType());
                    var logResponse = farmingJournalService.createEntry(userId, logReq, story.getImageUrl());
                    story.setFarmingLogId(logResponse.getId());
                    storyRepository.save(story);
                } catch (Exception ex) {
                    System.out.println("Failed to sync farming journal: " + ex.getMessage());
                }
            }

            return ResponseEntity.ok(mapStory(story));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStory(
            @RequestHeader("Authorization") String token,
            @PathVariable Long id) {
        try {
            Long userId = jwtService.extractId(token);
            Story story = storyRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Story not found"));
            if (!story.getSeller().getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
            }
            storyRepository.delete(story);
            return ResponseEntity.ok(Map.of("message", "Deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private Map<String, Object> mapStory(Story s) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", s.getId());
        map.put("sellerId", s.getSeller().getId());
        map.put("sellerName", s.getSeller().getFullName() != null ? s.getSeller().getFullName() : s.getSeller().getUsername());
        map.put("title", s.getTitle());
        map.put("content", s.getContent());
        map.put("imageUrl", s.getImageUrl());
        map.put("videoUrl", s.getVideoUrl());
        map.put("batchId", s.getBatchId());
        map.put("activityType", s.getActivityType());
        map.put("likesCount", s.getLikesCount());
        map.put("createdAt", s.getCreatedAt());
        return map;
    }
}
