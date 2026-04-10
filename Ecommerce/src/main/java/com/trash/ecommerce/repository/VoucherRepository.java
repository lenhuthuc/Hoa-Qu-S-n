package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface VoucherRepository extends JpaRepository<Voucher, Long> {

    Optional<Voucher> findByCode(String code);

    List<Voucher> findByIsActiveTrueAndStartDateBeforeAndEndDateAfter(Date now1, Date now2);

    List<Voucher> findBySellerIdAndIsActiveTrue(Long sellerId);

    List<Voucher> findBySellerId(Long sellerId);

    boolean existsByCode(String code);
}
