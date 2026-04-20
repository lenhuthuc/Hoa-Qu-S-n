package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.BatchCreateRequestDTO;
import com.trash.ecommerce.dto.BatchResponseDTO;
import com.trash.ecommerce.entity.FarmingBatch;
import com.trash.ecommerce.repository.FarmingBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TraceabilityBatchService {

    private final FarmingBatchRepository farmingBatchRepository;

    @Value("${app.frontend-base-url:http://localhost:3001}")
    private String frontendBaseUrl;

    public List<BatchResponseDTO> listBySeller(Long sellerId) {
        return farmingBatchRepository.findBySellerIdOrderByCreatedAtDesc(sellerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public BatchResponseDTO create(Long sellerId, BatchCreateRequestDTO request) {
        if (request == null || request.getBatchName() == null || request.getBatchName().isBlank()) {
            throw new IllegalArgumentException("Tên luống là bắt buộc");
        }

        String batchId = UUID.randomUUID().toString();
        String qrValue = frontendBaseUrl + "/trace/" + batchId;

        FarmingBatch batch = new FarmingBatch();
        batch.setBatchId(batchId);
        batch.setSellerId(sellerId);
        batch.setBatchName(request.getBatchName().trim());
        batch.setCropType(request.getCropType() == null ? null : request.getCropType().trim());

        LocalDate startDate = request.getStartDate();
        batch.setStartDate(startDate);
        batch.setPlantedAt(startDate);

        batch.setStatus("GROWING");
        batch.setQrCodeValue(qrValue);
        batch.setQrCodeUrl(qrValue);

        return toResponse(farmingBatchRepository.save(batch));
    }

    public FarmingBatch requireOwnedBatch(String batchId, Long sellerId) {
        return farmingBatchRepository.findByBatchIdAndSellerId(batchId, sellerId)
                .orElseThrow(() -> new IllegalArgumentException("Batch không hợp lệ hoặc không thuộc quyền sở hữu"));
    }

    private BatchResponseDTO toResponse(FarmingBatch batch) {
        return BatchResponseDTO.builder()
                .batchId(batch.getBatchId())
                .batchName(batch.getBatchName())
                .cropType(batch.getCropType())
                .startDate(batch.getStartDate() != null ? batch.getStartDate() : batch.getPlantedAt())
                .status(batch.getStatus())
                .qrCodeValue(batch.getQrCodeValue())
                .qrCodeUrl(batch.getQrCodeUrl())
                .createdAt(batch.getCreatedAt())
                .build();
    }
}
