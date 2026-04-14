package com.trash.ecommerce.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "provinces")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Province {
    @Id
    @Column(name = "code", length = 20)
    @EqualsAndHashCode.Include
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "type", length = 100)
    private String type;
}
