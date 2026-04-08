package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.FarmingLogRequest;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.service.FarmingJournalService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.trash.ecommerce.entity.Users;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/farming-journal")
@RequiredArgsConstructor
public class FarmingJournalController {

    private final FarmingJournalService farmingJournalService;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ResponseEntity<Map<String, Object>> createEntry(
            @AuthenticationPrincipal Users user,
            @RequestPart(value = "data", required = false) String dataJson,
            @RequestParam(value = "batchId", required = false) String batchId,
            @RequestParam(value = "note", required = false) String note,
            @RequestParam(value = "activityType", required = false) String activityType,
            @RequestParam(value = "weatherCondition", required = false) String weatherCondition,
            @RequestPart(value = "image", required = false) MultipartFile image) {

        FarmingLogRequest request;
        if (dataJson != null && !dataJson.isEmpty()) {
            // Supports JSON "data" part (Postman / structured clients)
            try {
                request = objectMapper.readValue(dataJson, FarmingLogRequest.class);
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Invalid data JSON"));
            }
        } else {
            // Supports individual form fields (frontend FormData)
            request = FarmingLogRequest.builder()
                    .batchId(batchId)
                    .note(note)
                    .activityType(activityType)
                    .weatherCondition(weatherCondition)
                    .build();
        }

        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            String filename = System.currentTimeMillis() + "_" + image.getOriginalFilename();
            imageUrl = "/uploads/farming/" + filename;
            try {
                java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads/farming");
                java.nio.file.Files.createDirectories(uploadDir);
                java.nio.file.Path target = uploadDir.resolve(filename);
                image.transferTo(target.toFile());
            } catch (Exception e) {
                // Log but don't fail the entire request
                imageUrl = null;
            }
        }

        FarmingLogResponse response = farmingJournalService.createEntry(user.getId(), request, imageUrl);
        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }

    @GetMapping("/batch/{batchId}")
    public ResponseEntity<Map<String, Object>> getByBatch(@PathVariable String batchId) {
        List<FarmingLogResponse> logs = farmingJournalService.getByBatchId(batchId);
        return ResponseEntity.ok(Map.of("success", true, "data", logs));
    }

    @GetMapping("/my-entries")
    public ResponseEntity<Map<String, Object>> getMyEntries(@AuthenticationPrincipal Users user) {
        List<FarmingLogResponse> logs = farmingJournalService.getBySellerId(user.getId());
        return ResponseEntity.ok(Map.of("success", true, "data", logs));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteEntry(
            @AuthenticationPrincipal Users user,
            @PathVariable String id) {
        farmingJournalService.deleteEntry(id, user.getId());
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("message", "Entry deleted")));
    }
}
