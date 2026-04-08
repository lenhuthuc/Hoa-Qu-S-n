package com.trash.ecommerce.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.dto.TraceabilityResponse;
import com.trash.ecommerce.entity.FarmingLog;
import com.trash.ecommerce.repository.FarmingLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TraceabilityService {

    private final FarmingLogRepository farmingLogRepository;

    public TraceabilityResponse getTraceability(String batchId) {
        List<FarmingLog> logs = farmingLogRepository.findByBatchIdOrderByCreatedAtAsc(batchId);

        if (logs.isEmpty()) {
            throw new RuntimeException("No farming data found for batch: " + batchId);
        }

        List<FarmingLogResponse> timeline = logs.stream()
                .map(log -> FarmingLogResponse.builder()
                        .id(log.getId())
                        .batchId(log.getBatchId())
                        .sellerId(log.getSellerId())
                        .imageUrl(log.getImageUrl())
                        .note(log.getNote())
                        .gpsLat(log.getGpsLat())
                        .gpsLng(log.getGpsLng())
                        .capturedAt(log.getCapturedAt())
                        .createdAt(log.getCreatedAt())
                        .activityType(log.getActivityType())
                        .weatherCondition(log.getWeatherCondition())
                        .build())
                .collect(Collectors.toList());

        return TraceabilityResponse.builder()
                .batchId(batchId)
                .timeline(timeline)
                .totalEntries(timeline.size())
                .build();
    }

    public byte[] generateQrCode(String batchId, String baseUrl) {
        // Verify batch exists
        long count = farmingLogRepository.countByBatchId(batchId);
        if (count == 0) {
            throw new RuntimeException("No farming data found for batch: " + batchId);
        }

        String qrContent = baseUrl + "/trace/" + batchId;

        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix bitMatrix = writer.encode(qrContent, BarcodeFormat.QR_CODE, 400, 400);
            BufferedImage image = MatrixToImageWriter.toBufferedImage(bitMatrix);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "PNG", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate QR code: " + e.getMessage());
        }
    }

    public String generateQrCodeBase64(String batchId, String baseUrl) {
        byte[] qrBytes = generateQrCode(batchId, baseUrl);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(qrBytes);
    }
}
