package com.trash.ecommerce.service.impl;

import com.trash.ecommerce.dto.VoucherCreateDTO;
import com.trash.ecommerce.dto.VoucherDTO;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.entity.Voucher;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.repository.VoucherRepository;
import com.trash.ecommerce.service.VoucherService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class VoucherServiceImpl implements VoucherService {

    @Autowired
    private VoucherRepository voucherRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional
    public VoucherDTO createVoucher(Long sellerId, VoucherCreateDTO dto) {
        if (voucherRepository.existsByCode(dto.getCode())) {
            throw new RuntimeException("Mã voucher đã tồn tại");
        }
        Users seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        Voucher voucher = new Voucher();
        voucher.setCode(dto.getCode().toUpperCase());
        voucher.setDescription(dto.getDescription());
        voucher.setDiscountType(dto.getDiscountType());
        voucher.setDiscountValue(dto.getDiscountValue());
        voucher.setMinOrderAmount(dto.getMinOrderAmount());
        voucher.setMaxDiscount(dto.getMaxDiscount());
        voucher.setUsageLimit(dto.getUsageLimit());
        voucher.setStartDate(dto.getStartDate());
        voucher.setEndDate(dto.getEndDate());
        voucher.setSeller(seller);
        voucherRepository.save(voucher);
        return toDTO(voucher);
    }

    @Override
    public List<VoucherDTO> getAvailableVouchers() {
        Date now = new Date();
        return voucherRepository.findByIsActiveTrueAndStartDateBeforeAndEndDateAfter(now, now)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<VoucherDTO> getSellerVouchers(Long sellerId) {
        return voucherRepository.findBySellerId(sellerId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public VoucherDTO validateVoucher(String code, BigDecimal orderAmount) {
        Voucher voucher = voucherRepository.findByCode(code.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Mã voucher không tồn tại"));
        if (!voucher.isValid()) {
            throw new RuntimeException("Mã voucher đã hết hạn hoặc hết lượt sử dụng");
        }
        if (voucher.getMinOrderAmount() != null && orderAmount.compareTo(voucher.getMinOrderAmount()) < 0) {
            throw new RuntimeException("Đơn hàng chưa đạt giá trị tối thiểu " + voucher.getMinOrderAmount());
        }
        VoucherDTO dto = toDTO(voucher);
        dto.setDiscountValue(voucher.calculateDiscount(orderAmount));
        return dto;
    }

    @Override
    @Transactional
    public BigDecimal applyVoucher(String code, BigDecimal orderAmount) {
        Voucher voucher = voucherRepository.findByCode(code.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Mã voucher không tồn tại"));
        if (!voucher.isValid()) {
            throw new RuntimeException("Mã voucher không hợp lệ");
        }
        BigDecimal discount = voucher.calculateDiscount(orderAmount);
        voucher.setUsedCount(voucher.getUsedCount() + 1);
        voucherRepository.save(voucher);
        return discount;
    }

    @Override
    @Transactional
    public void deleteVoucher(Long voucherId, Long sellerId) {
        Voucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new RuntimeException("Voucher không tồn tại"));
        if (!voucher.getSeller().getId().equals(sellerId)) {
            throw new RuntimeException("Bạn không có quyền xoá voucher này");
        }
        voucherRepository.delete(voucher);
    }

    private VoucherDTO toDTO(Voucher v) {
        VoucherDTO dto = new VoucherDTO();
        dto.setId(v.getId());
        dto.setCode(v.getCode());
        dto.setDescription(v.getDescription());
        dto.setDiscountType(v.getDiscountType());
        dto.setDiscountValue(v.getDiscountValue());
        dto.setMinOrderAmount(v.getMinOrderAmount());
        dto.setMaxDiscount(v.getMaxDiscount());
        dto.setUsageLimit(v.getUsageLimit());
        dto.setUsedCount(v.getUsedCount());
        dto.setStartDate(v.getStartDate());
        dto.setEndDate(v.getEndDate());
        dto.setIsActive(v.getIsActive());
        if (v.getSeller() != null) {
            dto.setSellerId(v.getSeller().getId());
            dto.setSellerName(v.getSeller().getFullName());
        }
        return dto;
    }
}
