package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "wards")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Ward {
    @Id
    @Column(name = "code", length = 20)
    @EqualsAndHashCode.Include
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "type", length = 100)
    private String type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_code")
    private District district;
}
