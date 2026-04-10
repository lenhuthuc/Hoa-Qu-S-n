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

    @Column(name = "province", nullable = false, length = 100)
    private String province;

    @Column(name = "district", nullable = false, length = 100)
    private String district;

    @Column(name = "ward", nullable = false, length = 100)
    private String ward;

    @Column(name = "street_detail", length = 255)
    private String streetDetail;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    public String getFullAddress() {
        StringBuilder sb = new StringBuilder();
        if (streetDetail != null && !streetDetail.isBlank()) sb.append(streetDetail).append(", ");
        sb.append(ward).append(", ").append(district).append(", ").append(province);
        return sb.toString();
    }
}
