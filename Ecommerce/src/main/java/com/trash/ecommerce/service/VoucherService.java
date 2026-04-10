package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.VoucherCreateDTO;
import com.trash.ecommerce.dto.VoucherDTO;

import java.math.BigDecimal;
import java.util.List;

public interface VoucherService {
    VoucherDTO createVoucher(Long sellerId, VoucherCreateDTO dto);
    List<VoucherDTO> getAvailableVouchers();
    List<VoucherDTO> getSellerVouchers(Long sellerId);
    VoucherDTO validateVoucher(String code, BigDecimal orderAmount);
    BigDecimal applyVoucher(String code, BigDecimal orderAmount);
    void deleteVoucher(Long voucherId, Long sellerId);
}
