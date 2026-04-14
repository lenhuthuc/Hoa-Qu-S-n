package com.trash.ecommerce.service;

import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import com.trash.ecommerce.dto.*;
import com.trash.ecommerce.entity.Address;
import com.trash.ecommerce.entity.Role;
import com.trash.ecommerce.exception.FindingUserError;
import com.trash.ecommerce.exception.UserAuthorizationException;
import com.trash.ecommerce.mapper.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.trash.ecommerce.entity.Cart;
import com.trash.ecommerce.entity.Product;
import com.trash.ecommerce.entity.Users;
import com.trash.ecommerce.repository.CartRepository;
import com.trash.ecommerce.repository.ProductRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.repository.ProvinceRepository;
import com.trash.ecommerce.repository.DistrictRepository;
import com.trash.ecommerce.repository.WardRepository;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder en;
    @Autowired
    private RoleService roleService;
    @Autowired
    private AuthenticationManager auth;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private CartRepository cartRepository;
    @Autowired
    private ProductRepository productRepository;
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    @Autowired
    private EmailService emailService;
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private ProvinceRepository provinceRepository;
    @Autowired
    private DistrictRepository districtRepository;
    @Autowired
    private WardRepository wardRepository;

    @Value("${admin.emails:}")
    private String adminEmailsConfig;

    private boolean isAdminEmail(String email) {
        if (adminEmailsConfig == null || adminEmailsConfig.isBlank()) return false;
        return Arrays.stream(adminEmailsConfig.split(","))
                .map(String::trim)
                .anyMatch(e -> e.equalsIgnoreCase(email));
    }

    @Override
    public List<UserProfileDTO> findAllUser(int noPage, int sizePage) {
        PageRequest pageRequest = PageRequest.of(noPage, sizePage);
        List<UserProfileDTO> users = userRepository.findAll(pageRequest).getContent()
                .stream().map(user -> userMapper.mapToUserProfileDTO(user)).toList();
        return users;
    }

    @Override
    public UserRegisterResponseDTO register(UserRegisterRequestDTO user) {
        Users tmpUser = new Users();
        String email = user.getEmail();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email đã tồn tại");
        }
        tmpUser.setEmail(user.getEmail());
        String password = en.encode(user.getPassword());
        tmpUser.setPassword(password);
        Set<Role> roles = new HashSet<>();
        Role userRole = roleService.findRoleByName("USER");
        if (userRole == null) {
            throw new RuntimeException("USER role not found in system");
        }
        roles.add(userRole);
        if (isAdminEmail(user.getEmail())) {
            Role adminRole = roleService.findRoleByName("ADMIN");
            if (adminRole != null) {
                roles.add(adminRole);
            }
        }
        tmpUser.setRoles(roles);
        Cart cart = new Cart();
        cart.setUser(tmpUser);
        tmpUser.setCart(cart);
        cartRepository.save(cart);
        userRepository.save(tmpUser);
        return new UserRegisterResponseDTO("Đăng kí thành công");
    }

    @Override
    public UserLoginResponseDTO login(UserLoginRequestDTO user) {
        try {
            Authentication authentication = auth
                    .authenticate(new UsernamePasswordAuthenticationToken(user.getEmail(), user.getPassword()));
            if (authentication != null && authentication.isAuthenticated()) {
                Users u = userRepository.findByEmail(user.getEmail())
                        .orElseThrow(() -> new RuntimeException("user is not found"));
                // Auto-promote to ADMIN if email is in admin list
                if (isAdminEmail(u.getEmail())) {
                    boolean hasAdmin = u.getRoles().stream()
                            .anyMatch(r -> "ADMIN".equals(r.getRoleName()));
                    if (!hasAdmin) {
                        Role adminRole = roleService.findRoleByName("ADMIN");
                        if (adminRole != null) {
                            u.getRoles().add(adminRole);
                            userRepository.save(u);
                        }
                    }
                }
                Token token = jwtService.generateToken(u, u.getId());
                Date expiration = null;
                if (token.getRefresh() != null) {
                    Date extractedExpiration = jwtService.extractExpiration(token.getRefresh());
                    if (extractedExpiration != null) {
                        expiration = new java.sql.Date(extractedExpiration.getTime());
                    }
                }
                return new UserLoginResponseDTO(token, "Bearer", expiration, "Succesful");
            }
        } catch (org.springframework.security.authentication.BadCredentialsException e) {
            throw new BadCredentialsException("Sai email/mật khẩu");
        } catch (Exception e) {
            throw new RuntimeException("Login failed: " + e.getMessage(), e);
        }
        return new UserLoginResponseDTO(new Token(null,null), null, null, "Sai email/mật khẩu");
    }

    @Override
    public UserResponseDTO logout(Long userId) {
        String key = "refresh:" + String.valueOf(userId);
        redisTemplate.delete(key);
        return new UserResponseDTO("Success");
    }

    @Override
    public UserProfileDTO findUsersById(Long id) {
        Users users = userRepository.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
        UserProfileDTO userProfileDTO = userMapper.mapToUserProfileDTO(users);
        return userProfileDTO;
    }

    @Override
    public UserProfileDTO getOwnProfile(Long id) {
        Users user = userRepository.findById(id)
                        .orElseThrow(() -> new RuntimeException("User is not found"));
        return userMapper.mapToUserProfileDTO(user);
    }

    @Override
    @Transactional
    public UserResponseDTO updateUser(UserUpdateRequestDTO user, Long id, Long userId) {
        Users currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("Current user not found"));

        Set<String> roles = new HashSet<>();
        for (Role role : currentUser.getRoles()) {
            roles.add(role.getRoleName());
        }

        if (!id.equals(userId) && !roles.contains("ADMIN")) {
            throw new FindingUserError("Not valid");
        }

        Users targetUser = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Target user not found"));

        if (user.getEmail() != null && !user.getEmail().isEmpty()) {
            targetUser.setEmail(user.getEmail());
        }

        if (user.getFullName() != null) {
            targetUser.setFullName(user.getFullName());
        }
        if (user.getPhone() != null) {
            targetUser.setPhone(user.getPhone());
        }
        if (user.getAvatar() != null) {
            targetUser.setAvatar(user.getAvatar());
        }

        boolean hasAddressPayload =
                user.getProvince() != null ||
                user.getDistrict() != null ||
                user.getWard() != null ||
                user.getStreetDetail() != null ||
                user.getGhnProvinceId() != null ||
                user.getGhnDistrictId() != null ||
                user.getGhnWardCode() != null;

        // Handle structured address with verified GHN IDs.
        if (hasAddressPayload) {
            if (isBlank(user.getProvince()) || isBlank(user.getDistrict()) || isBlank(user.getWard())) {
                throw new RuntimeException("Địa chỉ phải có đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã");
            }
            if (user.getGhnProvinceId() == null || user.getGhnProvinceId() <= 0) {
                throw new RuntimeException("Thiếu mã tỉnh/thành GHN hợp lệ");
            }
            if (user.getGhnDistrictId() == null || user.getGhnDistrictId() <= 0) {
                throw new RuntimeException("Thiếu mã quận/huyện GHN hợp lệ");
            }
            if (isBlank(user.getGhnWardCode())) {
                throw new RuntimeException("Thiếu mã phường/xã GHN hợp lệ");
            }

            Address address = targetUser.getAddress();
            if (address == null) {
                address = new Address();
            }
            
            com.trash.ecommerce.entity.Province prov = provinceRepository.findByGhnProvinceId(user.getGhnProvinceId())
                .orElseGet(() -> provinceRepository.findFirstByNameContainingIgnoreCase(user.getProvince().trim()).orElse(null));
            com.trash.ecommerce.entity.District dist = districtRepository.findByGhnDistrictId(user.getGhnDistrictId())
                .orElseGet(() -> districtRepository.findFirstByNameContainingIgnoreCase(user.getDistrict().trim()).orElse(null));
            com.trash.ecommerce.entity.Ward w = wardRepository.findByGhnWardCode(user.getGhnWardCode().trim())
                .orElseGet(() -> wardRepository.findFirstByNameContainingIgnoreCase(user.getWard().trim()).orElse(null));

            address.setProvince(prov);
            address.setDistrict(dist);
            address.setWard(w);
            address.setProvinceName(user.getProvince().trim());
            address.setDistrictName(user.getDistrict().trim());
            address.setWardName(user.getWard().trim());
            address.setStreetDetail(trimOrNull(user.getStreetDetail()));
            address.setGhnProvinceId(user.getGhnProvinceId());
            address.setGhnDistrictId(user.getGhnDistrictId());
            address.setGhnWardCode(user.getGhnWardCode().trim());
            targetUser.setAddress(address);
        }


        userRepository.save(targetUser);
        return new UserResponseDTO("Update thành công");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Override
    @Transactional
    public void deleteUser(Long id, String token) {
        Authentication authorities = SecurityContextHolder.getContext().getAuthentication();
        Set<String> roles = authorities.getAuthorities().stream().map(
                GrantedAuthority::getAuthority
        ).collect(Collectors.toSet());
        
        // Kiểm tra quyền: chỉ ADMIN hoặc user tự xóa chính mình mới được
        if (!roles.contains("ADMIN") && !Objects.equals(jwtService.extractId(token), id)) {
            throw new UserAuthorizationException("You do not have permission to delete this user");
        }
        
        Users user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Current user not found"));
        
        // Ngắt FK product.seller_id → users.id (không có cascade từ Users)
        List<Product> sellerProducts = productRepository.findBySellerId(id);
        for (Product product : sellerProducts) {
            product.setSeller(null);
        }
        productRepository.saveAll(sellerProducts);

        // Ngắt quan hệ ManyToMany (join tables)
        if (user.getRoles() != null) {
            user.getRoles().clear();
        }
        if (user.getPaymentMethods() != null) {
            user.getPaymentMethods().clear();
        }
        
        // CascadeType.ALL trên Users sẽ tự cascade delete:
        // cart, orders (→ orderItems, invoice → invoiceItems), reviews, invoices, userInteractions
        userRepository.delete(user);
    }

    @Override
    public UserResponseDTO resetPassword(String email) {
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        int number = (int)(Math.random() * 900000) + 100000;
        redisTemplate.opsForValue().set("otp:" + email, String.valueOf(number), 5, TimeUnit.MINUTES);
        emailService.sendEmail(email, "Reset Password", "Your otp code is : " + number);
        return new UserResponseDTO("OTP has been send");
    }

    @Override
    public boolean verifyOTP(String email, String OTP) {
        String key = "otp:" + email;
        String storeOtp = (String) redisTemplate.opsForValue().get(key);
        if (storeOtp == null) return false;
        return storeOtp.equals(OTP);
    }

    @Override
    public UserResponseDTO changePassword(String email, String newPassword, String otp) {
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (newPassword == null || newPassword.isEmpty()) {
            throw new IllegalArgumentException("New password is required");
        }
        String key = "otp:" + email;
        String storeOtp = (String) redisTemplate.opsForValue().get(key);
        if (storeOtp == null || !storeOtp.equals(otp)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }
        Users user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User is not found"));
        newPassword = en.encode(newPassword);
        user.setPassword(newPassword);
        userRepository.save(user);
        redisTemplate.delete(key);
        return new UserResponseDTO("Change password successfully");
    }

    @Override
    public String getClientIpAddress(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "unknown";
    }
}
