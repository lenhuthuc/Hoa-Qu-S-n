package com.trash.ecommerce.controller;

import com.trash.ecommerce.service.JwtService;
import com.trash.ecommerce.service.ReturnEvidenceService;
import com.trash.ecommerce.service.StorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/returns/evidence")
public class ReturnEvidenceController {

    @Autowired
    private ReturnEvidenceService returnEvidenceService;

    @Autowired
    private StorageService storageService;

    @Autowired
    private JwtService jwtService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadEvidence(
            @RequestHeader("Authorization") String token,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        try {
            Long userId = jwtService.extractId(token);
            List<MultipartFile> normalizedFiles = new ArrayList<>();
            if (files != null) {
                normalizedFiles.addAll(files);
            }
            if (file != null) {
                normalizedFiles.add(file);
            }

            List<String> urls = returnEvidenceService.uploadEvidence(userId, normalizedFiles);
            return ResponseEntity.ok(Map.of("success", true, "data", Map.of("urls", urls)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/media")
    public ResponseEntity<Resource> getEvidenceByUrl(
            @RequestParam("url") String mediaUrl,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            StorageService.DocumentFile docFile = storageService.downloadReviewMedia(mediaUrl);
            return buildMediaResponse(docFile, rangeHeader);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/media/{filename}")
    public ResponseEntity<Resource> getEvidenceByFilename(
            @PathVariable String filename,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            StorageService.DocumentFile docFile = storageService.downloadReviewMedia(filename);
            return buildMediaResponse(docFile, rangeHeader);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private ResponseEntity<Resource> buildMediaResponse(StorageService.DocumentFile docFile, String rangeHeader) {
        byte[] content = docFile.content();
        long totalLength = content.length;

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(docFile.contentType());
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + docFile.fileName() + "\"");
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
}