package com.trash.ecommerce.dto;

import com.trash.ecommerce.entity.SellerType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplicationSubmitRequestDTO {
    @NotBlank(message = "Tên shop không được để trống")
    @Size(min = 3, max = 60, message = "Tên shop phải từ 3-60 ký tự")
    @Pattern(regexp = "^[\\p{L}0-9 ]+$", message = "Tên shop không được chứa ký tự đặc biệt")
    private String shopName;

    @NotBlank(message = "Email liên hệ không được để trống")
    @Email(message = "Email liên hệ không hợp lệ")
    private String contactEmail;

    @NotBlank(message = "Số điện thoại không được để trống")
    private String contactPhone;

    private String pickupAddress;

    @NotBlank(message = "Tỉnh/Thành phố không được để trống")
    private String pickupProvince;

    @NotBlank(message = "Quận/Huyện không được để trống")
    private String pickupDistrict;

    @NotBlank(message = "Phường/Xã không được để trống")
    private String pickupWard;

    @NotNull(message = "Thiếu mã tỉnh/thành GHN")
    private Integer pickupGhnProvinceId;

    @NotNull(message = "Thiếu mã quận/huyện GHN")
    private Integer pickupGhnDistrictId;

    @NotBlank(message = "Thiếu mã phường/xã GHN")
    private String pickupGhnWardCode;

    private String pickupStreetDetail;

    @NotBlank(message = "Đơn vị vận chuyển không được để trống")
    private String shippingProvider;

    @NotNull(message = "Loại hình người bán là bắt buộc")
    private SellerType sellerType;

    private String taxCode;
    private String businessName;
    private String businessAddress;
    private String businessLicenseUrl;

    @NotBlank(message = "Họ tên theo giấy tờ không được để trống")
    private String identityFullName;

    @NotBlank(message = "Số CMND/CCCD không được để trống")
    private String identityNumber;

    @NotNull(message = "Ngày cấp là bắt buộc")
    private LocalDate identityIssueDate;

    @NotBlank(message = "Nơi cấp không được để trống")
    private String identityIssuePlace;

    @NotBlank(message = "Ảnh mặt trước CMND/CCCD là bắt buộc")
    private String idCardFrontUrl;

    @NotBlank(message = "Ảnh mặt sau CMND/CCCD là bắt buộc")
    private String idCardBackUrl;

    @NotNull(message = "Bạn cần đồng ý điều khoản trước khi gửi")
    private Boolean agreedToTerms;
}