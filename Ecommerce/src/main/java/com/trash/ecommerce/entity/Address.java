package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "addresses")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Address {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "province_code", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Province province;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_code", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private District district;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ward_code", foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))
    private Ward ward;

    @Column(name = "street_detail", length = 255)
    private String streetDetail;

    @Column(name = "ghn_province_id")
    private Integer ghnProvinceId;

    @Column(name = "ghn_district_id")
    private Integer ghnDistrictId;

    @Column(name = "ghn_ward_code", length = 20)
    private String ghnWardCode;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "province_name")
    private String provinceName;

    @Column(name = "district_name")
    private String districtName;

    @Column(name = "ward_name")
    private String wardName;

    public String getFullAddress() {
        StringBuilder sb = new StringBuilder();
        if (streetDetail != null && !streetDetail.isBlank()) sb.append(streetDetail).append(", ");
        
        String w = wardName != null ? wardName : (ward != null ? ward.getName() : null);
        String d = districtName != null ? districtName : (district != null ? district.getName() : null);
        String p = provinceName != null ? provinceName : (province != null ? province.getName() : null);

        if (w != null) sb.append(w).append(", ");
        if (d != null) sb.append(d).append(", ");
        if (p != null) sb.append(p);
        
        return sb.toString();
    }
}
