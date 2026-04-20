package com.trash.ecommerce.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SellerShopSettingsUpdateRequestDTO {
    private String shopName;
    private String avatar;
    private String province;
    private String district;
    private String ward;
    private String streetDetail;
    private Integer ghnProvinceId;
    private Integer ghnDistrictId;
    private String ghnWardCode;
}
