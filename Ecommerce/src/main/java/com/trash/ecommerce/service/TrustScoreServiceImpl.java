package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.TrustScoreDTO;
import com.trash.ecommerce.entity.ReturnStatus;
import com.trash.ecommerce.entity.TrustScore;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.ReturnRequestRepository;
import com.trash.ecommerce.repository.TrustScoreRepository;
import com.trash.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class TrustScoreServiceImpl implements TrustScoreService {

    @Autowired
    private TrustScoreRepository trustScoreRepository;
    @Autowired
    private ReturnRequestRepository returnRequestRepository;
    @Autowired
    private UserRepository userRepository;

    @Override
    public TrustScoreDTO getTrustScore(Long sellerId) {
        TrustScore ts = trustScoreRepository.findBySellerId(sellerId).orElse(null);
        if (ts == null) {
            return recalculateTrustScore(sellerId);
        }
        return toDTO(ts);
    }

    @Override
    @Transactional
    public TrustScoreDTO recalculateTrustScore(Long sellerId) {
        Users seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new RuntimeException("Seller not found"));

        TrustScore ts = trustScoreRepository.findBySellerId(sellerId)
                .orElseGet(() -> {
                    TrustScore newTs = new TrustScore();
                    newTs.setSeller(seller);
                    return newTs;
                });

        Double avgRating = trustScoreRepository.getAverageRatingBySellerId(sellerId);
        Integer totalReviews = trustScoreRepository.getTotalReviewsBySellerId(sellerId);
        Integer successfulOrders = trustScoreRepository.getSuccessfulOrdersBySellerId(sellerId);
        Integer cancelledOrders = trustScoreRepository.getCancelledOrdersBySellerId(sellerId);
        Integer totalOrders = trustScoreRepository.getTotalOrdersBySellerId(sellerId);
        Integer returnCount = returnRequestRepository.countBySellerIdAndStatus(sellerId, ReturnStatus.REFUNDED);

        ts.setAvgRating(avgRating != null ? BigDecimal.valueOf(avgRating).setScale(1, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        ts.setTotalReviews(totalReviews != null ? totalReviews : 0);
        ts.setSuccessfulOrders(successfulOrders != null ? successfulOrders : 0);
        ts.setCancelledOrders(cancelledOrders != null ? cancelledOrders : 0);
        ts.setTotalOrdersSold(totalOrders != null ? totalOrders : 0);
        ts.setReturnRequests(returnCount != null ? returnCount : 0);

        // Calculate on-time delivery rate
        if (totalOrders != null && totalOrders > 0) {
            BigDecimal otdRate = BigDecimal.valueOf(successfulOrders != null ? successfulOrders : 0)
                    .divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
            ts.setOnTimeDeliveryRate(otdRate);
        }

        // Trust Score Algorithm:
        // 40% avg_rating (scale 1-5 -> 0-10)
        // 30% successful order rate
        // 20% low cancel rate
        // 10% low return rate
        BigDecimal ratingScore = ts.getAvgRating().multiply(BigDecimal.valueOf(2)); // scale to 10
        BigDecimal successRate = totalOrders > 0
                ? BigDecimal.valueOf(ts.getSuccessfulOrders()).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP).multiply(BigDecimal.TEN)
                : BigDecimal.TEN;
        BigDecimal cancelPenalty = totalOrders > 0
                ? BigDecimal.TEN.subtract(BigDecimal.valueOf(ts.getCancelledOrders()).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(30)))
                : BigDecimal.TEN;
        if (cancelPenalty.compareTo(BigDecimal.ZERO) < 0) cancelPenalty = BigDecimal.ZERO;

        BigDecimal returnPenalty = totalOrders > 0
                ? BigDecimal.TEN.subtract(BigDecimal.valueOf(ts.getReturnRequests()).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(30)))
                : BigDecimal.TEN;
        if (returnPenalty.compareTo(BigDecimal.ZERO) < 0) returnPenalty = BigDecimal.ZERO;

        BigDecimal finalScore = ratingScore.multiply(BigDecimal.valueOf(0.4))
                .add(successRate.multiply(BigDecimal.valueOf(0.3)))
                .add(cancelPenalty.multiply(BigDecimal.valueOf(0.2)))
                .add(returnPenalty.multiply(BigDecimal.valueOf(0.1)))
                .setScale(2, RoundingMode.HALF_UP);

        if (finalScore.compareTo(BigDecimal.TEN) > 0) finalScore = BigDecimal.TEN;
        ts.setScore(finalScore);

        // Badge assignment
        BigDecimal cancelRate = totalOrders > 0
                ? BigDecimal.valueOf(ts.getCancelledOrders()).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        if (ts.getAvgRating().compareTo(new BigDecimal("4.8")) >= 0 && cancelRate.compareTo(new BigDecimal("2")) <= 0) {
            ts.setBadge("NONG_HO_TIEU_BIEU");
        } else if (ts.getAvgRating().compareTo(new BigDecimal("4.0")) >= 0 && cancelRate.compareTo(new BigDecimal("5")) <= 0) {
            ts.setBadge("UY_TIN");
        } else if (ts.getAvgRating().compareTo(new BigDecimal("3.0")) < 0 || cancelRate.compareTo(new BigDecimal("10")) > 0) {
            ts.setBadge("CAN_CAI_THIEN");
        } else {
            ts.setBadge(null);
        }

        trustScoreRepository.save(ts);
        return toDTO(ts);
    }

    private TrustScoreDTO toDTO(TrustScore ts) {
        TrustScoreDTO dto = new TrustScoreDTO();
        dto.setSellerId(ts.getSeller().getId());
        dto.setSellerName(ts.getSeller().getFullName());
        dto.setScore(ts.getScore());
        dto.setTotalReviews(ts.getTotalReviews());
        dto.setAvgRating(ts.getAvgRating());
        dto.setTotalOrdersSold(ts.getTotalOrdersSold());
        dto.setSuccessfulOrders(ts.getSuccessfulOrders());
        dto.setCancelledOrders(ts.getCancelledOrders());
        dto.setReturnRequests(ts.getReturnRequests());
        dto.setOnTimeDeliveryRate(ts.getOnTimeDeliveryRate());
        dto.setBadge(ts.getBadge());
        dto.setUpdatedAt(ts.getUpdatedAt());
        return dto;
    }
}
