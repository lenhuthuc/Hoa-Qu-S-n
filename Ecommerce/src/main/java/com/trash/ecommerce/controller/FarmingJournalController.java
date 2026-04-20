package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.FarmingLogRequest;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.service.FarmingJournalService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.trash.ecommerce.entity.Users;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Arrays;

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

    @GetMapping("/media")
    public ResponseEntity<Resource> getMediaByUrl(
            @RequestParam("url") String mediaUrl,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            MediaFile mediaFile = resolveMediaFile(mediaUrl);
            return buildMediaResponse(mediaFile, rangeHeader);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/media/{filename}")
    public ResponseEntity<Resource> getMediaByFilename(
            @PathVariable String filename,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            MediaFile mediaFile = resolveMediaFile(filename);
            return buildMediaResponse(mediaFile, rangeHeader);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
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

    private ResponseEntity<Resource> buildMediaResponse(MediaFile mediaFile, String rangeHeader) throws IOException {
        byte[] content = Files.readAllBytes(mediaFile.path());
        long totalLength = content.length;

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(mediaFile.contentType());
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + mediaFile.fileName() + "\"");
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");

        if (rangeHeader == null || !rangeHeader.startsWith("bytes=")) {
            headers.setContentLength(totalLength);
            return ResponseEntity.ok()
                    .headers(headers)
                    .contentType(mediaType)
                    .body(new ByteArrayResource(content));
        }

        long[] range = parseRange(rangeHeader, totalLength);
        if (range == null) {
            headers.set(HttpHeaders.CONTENT_RANGE, "bytes */" + totalLength);
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .headers(headers)
                    .contentType(mediaType)
                    .build();
        }

        int start = (int) range[0];
        int end = (int) range[1];
        byte[] partial = Arrays.copyOfRange(content, start, end + 1);

        headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + totalLength);
        headers.setContentLength(partial.length);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .headers(headers)
                .contentType(mediaType)
                .body(new ByteArrayResource(partial));
    }

    private long[] parseRange(String rangeHeader, long totalLength) {
        try {
            String spec = rangeHeader.substring("bytes=".length()).trim();
            if (spec.contains(",")) {
                spec = spec.split(",")[0].trim();
            }

            String[] parts = spec.split("-", 2);
            String startPart = parts.length > 0 ? parts[0].trim() : "";
            String endPart = parts.length > 1 ? parts[1].trim() : "";

            long start;
            long end;

            if (startPart.isEmpty()) {
                long suffixLength = Long.parseLong(endPart);
                if (suffixLength <= 0) {
                    return null;
                }
                start = Math.max(0, totalLength - suffixLength);
                end = totalLength - 1;
            } else {
                start = Long.parseLong(startPart);
                end = endPart.isEmpty() ? totalLength - 1 : Long.parseLong(endPart);
            }

            if (start < 0 || end < start || start >= totalLength) {
                return null;
            }

            end = Math.min(end, totalLength - 1);
            return new long[]{start, end};
        } catch (Exception ignored) {
            return null;
        }
    }

    private MediaFile resolveMediaFile(String rawMediaUrl) {
        if (rawMediaUrl == null || rawMediaUrl.isBlank()) {
            throw new IllegalArgumentException("Thiếu URL media");
        }

        String mediaUrl = rawMediaUrl.trim();
        if (mediaUrl.startsWith("/api/farming-journal/media")) {
            return resolveMediaFile(mediaUrl.substring(mediaUrl.indexOf("url=") >= 0 ? mediaUrl.indexOf("url=") + 4 : mediaUrl.length()));
        }

        String filename = mediaUrl;
        if (mediaUrl.startsWith("/uploads/farming/")) {
            filename = mediaUrl.substring("/uploads/farming/".length());
        } else if (mediaUrl.startsWith("uploads/farming/")) {
            filename = mediaUrl.substring("uploads/farming/".length());
        }

        Path path = Paths.get("uploads/farming").resolve(filename).normalize();
        if (!Files.exists(path) || !path.startsWith(Paths.get("uploads/farming").normalize())) {
            throw new IllegalArgumentException("Media không tồn tại");
        }

        String contentType;
        try {
            contentType = Files.probeContentType(path);
        } catch (IOException ignored) {
            contentType = null;
        }
        if (contentType == null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".mp4")) contentType = "video/mp4";
            else if (lower.endsWith(".webm")) contentType = "video/webm";
            else if (lower.endsWith(".mov")) contentType = "video/quicktime";
            else if (lower.endsWith(".png")) contentType = "image/png";
            else contentType = "image/jpeg";
        }

        return new MediaFile(path, path.getFileName().toString(), contentType);
    }

    private record MediaFile(Path path, String fileName, String contentType) {}
}
