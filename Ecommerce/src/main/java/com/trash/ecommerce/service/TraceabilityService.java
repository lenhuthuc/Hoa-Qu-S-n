package com.trash.ecommerce.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.dto.TraceabilityResponse;
import com.trash.ecommerce.entity.FarmingLog;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.repository.FarmingLogRepository;
import com.trash.ecommerce.repository.ProductRepository;
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
    private final ProductRepository productRepository;

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

        // Populate product info from linked product
        String productName = null;
        String sellerName = null;
        String origin = null;
        List<Product> products = productRepository.findByBatchId(batchId);
        if (!products.isEmpty()) {
            Product product = products.get(0);
            productName = product.getProductName();
            origin = product.getOrigin();
            if (product.getSeller() != null) {
                sellerName = product.getSeller().getFullName() != null
                        ? product.getSeller().getFullName()
                        : product.getSeller().getEmail();
            }
        }

        // Derive planting/harvest dates from timeline
        String plantedAt = timeline.stream()
                .filter(t -> "PLANTING".equals(t.getActivityType()))
                .findFirst()
                .map(t -> t.getCapturedAt() != null ? t.getCapturedAt().toString() : null)
                .orElse(null);
        String harvestAt = timeline.stream()
                .filter(t -> "HARVESTING".equals(t.getActivityType()))
                .findFirst()
                .map(t -> t.getCapturedAt() != null ? t.getCapturedAt().toString() : null)
                .orElse(null);

        return TraceabilityResponse.builder()
                .batchId(batchId)
                .productName(productName)
                .sellerName(sellerName)
                .origin(origin)
                .plantedAt(plantedAt)
                .harvestAt(harvestAt)
                .status(harvestAt != null ? "HARVESTED" : "GROWING")
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
