package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.FarmingLogRequest;
import com.trash.ecommerce.dto.FarmingLogResponse;
import com.trash.ecommerce.entity.FarmingLog;
import com.trash.ecommerce.repository.FarmingLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FarmingJournalService {

    private final FarmingLogRepository farmingLogRepository;

    public FarmingLogResponse createEntry(Long sellerId, FarmingLogRequest request, String imageUrl) {
        FarmingLog log = FarmingLog.builder()
                .batchId(request.getBatchId())
                .sellerId(sellerId)
                .imageUrl(imageUrl)
                .note(request.getNote())
                .gpsLat(request.getGpsLat())
                .gpsLng(request.getGpsLng())
                .capturedAt(request.getCapturedAt() != null ? request.getCapturedAt() : Instant.now())
                .createdAt(Instant.now())
                .activityType(request.getActivityType())
                .weatherCondition(request.getWeatherCondition())
                .build();

        FarmingLog saved = farmingLogRepository.save(log);
        return toResponse(saved);
    }

    public List<FarmingLogResponse> getByBatchId(String batchId) {
        return farmingLogRepository.findByBatchIdOrderByCreatedAtAsc(batchId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<FarmingLogResponse> getBySellerId(Long sellerId) {
        return farmingLogRepository.findBySellerIdOrderByCreatedAtDesc(sellerId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void deleteEntry(String id, Long sellerId) {
        FarmingLog log = farmingLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Farming log not found"));
        if (!log.getSellerId().equals(sellerId)) {
            throw new RuntimeException("Not authorized to delete this entry");
        }
        farmingLogRepository.delete(log);
    }

    private FarmingLogResponse toResponse(FarmingLog log) {
        return FarmingLogResponse.builder()
                .id(log.getId())
                .batchId(log.getBatchId())
                .sellerId(log.getSellerId())
                .imageUrl(log.getImageUrl())
                .videoUrl(log.getVideoUrl())
                .note(log.getNote())
                .gpsLat(log.getGpsLat())
                .gpsLng(log.getGpsLng())
                .capturedAt(log.getCapturedAt())
                .createdAt(log.getCreatedAt())
                .weatherCondition(log.getWeatherCondition())
                .activityType(log.getActivityType())
                .build();
    }
}
