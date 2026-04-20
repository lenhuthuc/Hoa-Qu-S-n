package com.trash.ecommerce.repository;

import com.trash.ecommerce.entity.Province;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProvinceRepository extends JpaRepository<Province, String> {
    java.util.Optional<Province> findFirstByNameContainingIgnoreCase(String name);
    java.util.Optional<Province> findByGhnProvinceId(Integer ghnProvinceId);
}
