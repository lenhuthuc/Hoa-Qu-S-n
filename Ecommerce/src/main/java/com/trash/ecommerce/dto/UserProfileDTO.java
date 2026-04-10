package com.trash.ecommerce.dto;

import java.util.Set;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class UserProfileDTO {
    private Long id;
    private String email;
    private String fullName;
    private String phone;
    private String avatar;
    private AddressDTO address;
    private Set<String> roles;

    @NoArgsConstructor
    @AllArgsConstructor
    @Data
    public static class AddressDTO {
        private Long id;
        private String province;
        private String district;
        private String ward;
        private String streetDetail;
    }
}
