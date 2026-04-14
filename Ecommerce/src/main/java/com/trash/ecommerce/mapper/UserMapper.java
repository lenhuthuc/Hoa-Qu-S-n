package com.trash.ecommerce.mapper;

import com.trash.ecommerce.dto.UserProfileDTO;
import com.trash.ecommerce.entity.Address;
import com.trash.ecommerce.entity.Role;
import com.trash.ecommerce.entity.Users;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class UserMapper {
    public UserProfileDTO mapToUserProfileDTO(Users users) {
        UserProfileDTO dto = new UserProfileDTO();
        dto.setId(users.getId());
        dto.setEmail(users.getEmail());
        dto.setFullName(users.getFullName());
        dto.setPhone(users.getPhone());
        dto.setAvatar(users.getAvatar());
        if (users.getAddress() != null) {
            Address addr = users.getAddress();
            dto.setAddress(new UserProfileDTO.AddressDTO(
                    addr.getId(),
                    addr.getProvinceName() != null ? addr.getProvinceName() : (addr.getProvince() != null ? addr.getProvince().getName() : null),
                    addr.getDistrictName() != null ? addr.getDistrictName() : (addr.getDistrict() != null ? addr.getDistrict().getName() : null),
                    addr.getWardName() != null ? addr.getWardName() : (addr.getWard() != null ? addr.getWard().getName() : null),
                    addr.getStreetDetail(),
                    addr.getGhnProvinceId(),
                    addr.getGhnDistrictId(),
                    addr.getGhnWardCode()
            ));
        }
        dto.setRoles(users.getRoles().stream()
                .map(Role::getRoleName)
                .collect(Collectors.toSet()));
        return dto;
    }
}
