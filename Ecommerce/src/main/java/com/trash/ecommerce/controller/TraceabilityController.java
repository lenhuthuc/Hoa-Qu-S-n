package com.trash.ecommerce.controller;

import com.trash.ecommerce.dto.TraceabilityResponse;
import com.trash.ecommerce.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/traceability")
@RequiredArgsConstructor
public class TraceabilityController {

    private final TraceabilityService traceabilityService;

    @GetMapping("/{batchId}")
    public ResponseEntity<Map<String, Object>> getTraceability(@PathVariable String batchId) {
        TraceabilityResponse response = traceabilityService.getTraceability(batchId);
        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }

    @PostMapping("/{batchId}/generate-qr")
    public ResponseEntity<byte[]> generateQrCode(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "http://localhost:3001") String baseUrl) {

        byte[] qrImage = traceabilityService.generateQrCode(batchId, baseUrl);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=qr-" + batchId + ".png")
                .contentType(MediaType.IMAGE_PNG)
                .body(qrImage);
    }

    @GetMapping("/{batchId}/qr-base64")
    public ResponseEntity<Map<String, Object>> getQrBase64(
            @PathVariable String batchId,
            @RequestParam(defaultValue = "http://localhost:3001") String baseUrl) {

        String qrBase64 = traceabilityService.generateQrCodeBase64(batchId, baseUrl);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("batchId", batchId, "qrCode", qrBase64)
        ));
    }
}
