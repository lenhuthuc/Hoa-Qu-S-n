package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "districts")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class District {
    @Id
    @Column(name = "code", length = 20)
    @EqualsAndHashCode.Include
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "type", length = 100)
    private String type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "province_code")
    private Province province;

    @Column(name = "ghn_district_id")
    private Integer ghnDistrictId;
}
