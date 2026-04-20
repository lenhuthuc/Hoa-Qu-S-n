package com.trash.ecommerce.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.dto.TraceabilityResponse;
import com.trash.ecommerce.entity.FarmingBatch;
import com.trash.ecommerce.entity.FarmingLog;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.TraceabilityMilestone;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.FarmingBatchRepository;
import com.trash.ecommerce.repository.FarmingLogRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.TraceabilityMilestoneRepository;
import com.trash.ecommerce.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class TraceabilityService {

    private final FarmingLogRepository farmingLogRepository;
    private final FarmingBatchRepository farmingBatchRepository;
    private final TraceabilityMilestoneRepository traceabilityMilestoneRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final SellerApplicationRepository sellerApplicationRepository;

    @Value("${app.frontend-base-url:http://localhost:3001}")
    private String frontendBaseUrl;

    public TraceabilityResponse getTraceability(String batchId) {
        FarmingBatch batch = farmingBatchRepository.findByBatchId(batchId).orElse(null);
        List<TraceabilityMilestone> milestones = traceabilityMilestoneRepository.findByBatchIdOrderByCreatedAtAsc(batchId);

        List<FarmingLogResponse> timeline = new ArrayList<>();
        if (!milestones.isEmpty()) {
            timeline = milestones.stream()
                    .map(this::mapMilestone)
                    .collect(Collectors.toList());
        }

        if (timeline.isEmpty()) {
            // Legacy fallback to Mongo farming logs while old data is still present.
            List<FarmingLog> logs = farmingLogRepository.findByBatchIdOrderByCreatedAtAsc(batchId);
            timeline = logs.stream()
                    .map(log -> FarmingLogResponse.builder()
                            .id(log.getId())
                            .title(null)
                            .batchId(log.getBatchId())
                            .sellerId(log.getSellerId())
                        .imageUrl(resolveMediaUrlForClient(log.getImageUrl()))
                        .videoUrl(resolveMediaUrlForClient(log.getVideoUrl()))
                            .mediaType(log.getVideoUrl() != null && !log.getVideoUrl().isBlank() ? "VIDEO" : "IMAGE")
                            .note(log.getNote())
                            .gpsLat(log.getGpsLat())
                            .gpsLng(log.getGpsLng())
                            .capturedAt(log.getCapturedAt())
                            .createdAt(log.getCreatedAt())
                            .activityType(log.getActivityType())
                            .weatherCondition(log.getWeatherCondition())
                            .build())
                    .collect(Collectors.toList());
        }

        if (timeline.isEmpty()) {
            throw new RuntimeException("No traceability data found for batch: " + batchId);
        }

        // Populate product info from linked product
        String productName = batch != null ? batch.getProductName() : null;
        String sellerName = resolveSellerName(batch);
        String origin = null;
        String cropType = batch != null ? batch.getCropType() : null;
        List<Product> products = productRepository.findByBatchId(batchId);
        if (!products.isEmpty()) {
            Product product = products.get(0);
            if (productName == null || productName.isBlank()) {
                productName = product.getProductName();
            }
            origin = product.getOrigin();
            if ((sellerName == null || sellerName.isBlank()) && product.getSeller() != null) {
                sellerName = resolveShopName(product.getSeller());
            }
        }

        // Derive planting/harvest dates from timeline
        String plantedAt = (batch != null && batch.getStartDate() != null)
            ? batch.getStartDate().toString()
            : timeline.stream()
                .filter(t -> "PLANTING".equals(t.getActivityType()))
                .findFirst()
                .map(t -> t.getCapturedAt() != null ? t.getCapturedAt().toString() : null)
                .orElse(null);
        String harvestAt = (batch != null && batch.getHarvestAt() != null)
            ? batch.getHarvestAt().toString()
            : timeline.stream()
                .filter(t -> "HARVESTING".equals(t.getActivityType()))
                .findFirst()
                .map(t -> t.getCapturedAt() != null ? t.getCapturedAt().toString() : null)
                .orElse(null);

        String qrCodeUrl = batch != null && batch.getQrCodeUrl() != null && !batch.getQrCodeUrl().isBlank()
            ? batch.getQrCodeUrl()
            : frontendBaseUrl + "/trace/" + batchId;

        String status = batch != null && batch.getStatus() != null && !batch.getStatus().isBlank()
            ? batch.getStatus()
            : (harvestAt != null ? "HARVESTED" : "GROWING");

        return TraceabilityResponse.builder()
                .batchId(batchId)
                .productName(productName)
            .cropType(cropType)
                .sellerName(sellerName)
                .origin(origin)
                .plantedAt(plantedAt)
                .harvestAt(harvestAt)
            .status(status)
            .qrCodeUrl(qrCodeUrl)
                .timeline(timeline)
                .totalEntries(timeline.size())
                .build();
    }

    public byte[] generateQrCode(String batchId, String baseUrl) {
        long traceEntryCount = traceabilityMilestoneRepository.countByBatchId(batchId)
            + farmingLogRepository.countByBatchId(batchId);
        boolean batchExists = farmingBatchRepository.findByBatchId(batchId).isPresent();
        if (traceEntryCount == 0 && !batchExists) {
            throw new RuntimeException("No traceability data found for batch: " + batchId);
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

    private FarmingLogResponse mapMilestone(TraceabilityMilestone m) {
        String resolvedMediaUrl = resolveMediaUrlForClient(m.getMediaUrl());
        String imageUrl = m.getMediaType() != null && m.getMediaType().equalsIgnoreCase("VIDEO")
            ? null
            : resolvedMediaUrl;
        String videoUrl = m.getMediaType() != null && m.getMediaType().equalsIgnoreCase("VIDEO")
            ? resolvedMediaUrl
            : null;

        return FarmingLogResponse.builder()
                .id(m.getId() != null ? String.valueOf(m.getId()) : null)
                .title(m.getTitle())
                .batchId(m.getBatchId())
                .sellerId(m.getSellerId())
                .imageUrl(imageUrl)
                .videoUrl(videoUrl)
                .mediaType(m.getMediaType())
                .note(m.getNote())
                .gpsLat(m.getGpsLat())
                .gpsLng(m.getGpsLng())
                .capturedAt(m.getCapturedAt() != null ? m.getCapturedAt().atZone(ZoneId.systemDefault()).toInstant() : null)
                .createdAt(m.getCreatedAt() != null ? m.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant() : null)
                .activityType(m.getActivityType())
                .weatherCondition(null)
                .build();
    }

    private String resolveMediaUrlForClient(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }

        String value = rawUrl.trim();
        if (value.startsWith("/api/reviews/media") || value.startsWith("/api/farming-journal/media")) {
            return value;
        }
        if (value.startsWith("/uploads/farming/") || value.startsWith("uploads/farming/")) {
            return "/api/farming-journal/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        if (value.contains(".r2.cloudflarestorage.com/") || value.startsWith("local:") || value.startsWith("review-media/") || value.startsWith("reviews/")) {
            return "/api/reviews/media?url=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
        return value;
    }

    private String resolveSellerName(FarmingBatch batch) {
        if (batch == null || batch.getSellerId() == null) {
            return null;
        }
        Users seller = userRepository.findById(batch.getSellerId()).orElse(null);
        return resolveShopName(seller);
    }

    private String resolveShopName(Users seller) {
        if (seller == null || seller.getId() == null) {
            return null;
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
                    return null;
                });
    }
}
