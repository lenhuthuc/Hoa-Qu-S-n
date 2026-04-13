package com.trash.ecommerce.config;

import com.trash.ecommerce.entity.Role;
import com.trash.ecommerce.repository.RoleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;

    public DataSeeder(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @Override
    public void run(String... args) {
        if (roleRepository.findByRoleName("USER").isEmpty()) {
            Role user = new Role();
            user.setRoleName("USER");
            roleRepository.save(user);
        }
        if (roleRepository.findByRoleName("ADMIN").isEmpty()) {
            Role admin = new Role();
            admin.setRoleName("ADMIN");
            roleRepository.save(admin);
        }
        if (roleRepository.findByRoleName("SELLER").isEmpty()) {
            Role seller = new Role();
            seller.setRoleName("SELLER");
            roleRepository.save(seller);
        }
    }
}
