package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.District;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DistrictRepository extends JpaRepository<District, String> {
    List<District> findByProvinceCode(String provinceCode);
    java.util.Optional<District> findFirstByNameContainingIgnoreCase(String name);
    java.util.Optional<District> findByGhnDistrictId(Integer ghnDistrictId);
}
