package com.trash.ecommerce.service;

import com.trash.ecommerce.dto.SellerApplicationResponseDTO;
import com.trash.ecommerce.dto.SellerApplicationSubmitRequestDTO;
import com.trash.ecommerce.entity.Address;
import com.trash.ecommerce.entity.*;
import com.trash.ecommerce.repository.RoleRepository;
import com.trash.ecommerce.repository.SellerApplicationRepository;
import com.trash.ecommerce.repository.UserRepository;
import com.trash.ecommerce.repository.ProvinceRepository;
import com.trash.ecommerce.repository.DistrictRepository;
import com.trash.ecommerce.repository.WardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SellerApplicationServiceImpl implements SellerApplicationService {
    private static final String FOOD_SAFETY_CERTIFICATE = "FOOD_SAFETY_CERTIFICATE";
    private static final String FOOD_SAFETY_COMMITMENT = "FOOD_SAFETY_COMMITMENT";

    private final SellerApplicationRepository sellerApplicationRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final WardRepository wardRepository;

    public SellerApplicationServiceImpl(
            SellerApplicationRepository sellerApplicationRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            NotificationService notificationService,
            EmailService emailService,
            ProvinceRepository provinceRepository,
            DistrictRepository districtRepository,
            WardRepository wardRepository
    ) {
        this.sellerApplicationRepository = sellerApplicationRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.provinceRepository = provinceRepository;
        this.districtRepository = districtRepository;
        this.wardRepository = wardRepository;
    }

    @Override
    @Transactional
    public SellerApplicationResponseDTO submit(Long userId, SellerApplicationSubmitRequestDTO request) {
        Users user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        SellerApplication app = sellerApplicationRepository.findByUserId(userId).orElseGet(SellerApplication::new);

        if (sellerApplicationRepository.existsByShopNameIgnoreCaseAndUserIdNot(request.getShopName().trim(), userId)) {
            throw new RuntimeException("Tên shop đã tồn tại, vui lòng chọn tên khác");
        }

        validateBusinessFields(request);
        validatePickupAddress(request);

        Address pickupAddress = user.getAddress();
        if (pickupAddress == null) {
            pickupAddress = new Address();
        }
        
        // Thử tìm theo GHN ID, nếu không thấy thì tìm theo tên
        Province prov = provinceRepository.findByGhnProvinceId(request.getPickupGhnProvinceId())
            .orElseGet(() -> provinceRepository.findFirstByNameContainingIgnoreCase(request.getPickupProvince().trim()).orElse(null));

        District dist = districtRepository.findByGhnDistrictId(request.getPickupGhnDistrictId())
            .orElseGet(() -> districtRepository.findFirstByNameContainingIgnoreCase(request.getPickupDistrict().trim()).orElse(null));

        Ward w = wardRepository.findByGhnWardCode(request.getPickupGhnWardCode().trim())
            .orElseGet(() -> wardRepository.findFirstByNameContainingIgnoreCase(request.getPickupWard().trim()).orElse(null));

        pickupAddress.setProvince(prov);
        pickupAddress.setDistrict(dist);
        pickupAddress.setWard(w);
        pickupAddress.setProvinceName(request.getPickupProvince().trim());
        pickupAddress.setDistrictName(request.getPickupDistrict().trim());
        pickupAddress.setWardName(request.getPickupWard().trim());
        pickupAddress.setStreetDetail(trimOrNull(request.getPickupStreetDetail()));
        pickupAddress.setGhnProvinceId(request.getPickupGhnProvinceId());
        pickupAddress.setGhnDistrictId(request.getPickupGhnDistrictId());
        pickupAddress.setGhnWardCode(request.getPickupGhnWardCode().trim());
        user.setAddress(pickupAddress);
        userRepository.save(user);

        app.setUser(user);
        app.setShopName(request.getShopName().trim());
        app.setContactEmail(request.getContactEmail().trim());
        app.setContactPhone(request.getContactPhone().trim());
        app.setPickupAddress(buildPickupAddressLine(
            request.getPickupStreetDetail(),
            request.getPickupWard(),
            request.getPickupDistrict(),
            request.getPickupProvince()
        ));
        app.setShippingProvider(request.getShippingProvider().trim());
        app.setSellerType(request.getSellerType());
        app.setTaxCode(trimOrNull(request.getTaxCode()));
        app.setBusinessName(trimOrNull(request.getBusinessName()));
        app.setBusinessAddress(trimOrNull(request.getBusinessAddress()));
        app.setBusinessLicenseUrl(trimOrNull(request.getBusinessLicenseUrl()));
        app.setFoodSafetyDocumentType(normalizeFoodSafetyDocumentType(request.getFoodSafetyDocumentType()));
        app.setFoodSafetyDocumentUrl(trimOrNull(request.getFoodSafetyDocumentUrl()));
        app.setIdentityFullName(request.getIdentityFullName().trim());
        app.setIdentityNumber(request.getIdentityNumber().trim());
        app.setIdentityIssueDate(request.getIdentityIssueDate());
        app.setIdentityIssuePlace(request.getIdentityIssuePlace().trim());
        app.setIdCardFrontUrl(request.getIdCardFrontUrl().trim());
        app.setIdCardBackUrl(request.getIdCardBackUrl().trim());
        app.setAgreedToTerms(Boolean.TRUE.equals(request.getAgreedToTerms()));
        app.setStatus(SellerApplicationStatus.SUBMITTED);
        app.setReviewNote(null);
        app.setReviewedAt(null);
        app.setReviewedBy(null);
        app.setSubmittedAt(LocalDateTime.now());

        SellerApplication saved = sellerApplicationRepository.save(app);

        notificationService.send(
                userId,
                "Đăng ký người bán đã gửi",
                "Hồ sơ của bạn đã được ghi nhận và đang chờ admin xét duyệt.",
                NotificationType.SYSTEM,
                saved.getId()
        );
        sendEmailAsync(
            saved.getContactEmail(),
            "[Hoa Quả Sơn] Hồ sơ đăng ký người bán đã được tiếp nhận",
            "Chào bạn,\n\nHồ sơ đăng ký người bán của bạn đã được ghi nhận và đang chờ admin xét duyệt.\nChúng tôi sẽ thông báo ngay khi có kết quả.\n\nTrân trọng,\nHoa Quả Sơn"
        );

        return toDTO(saved);
    }

    @Override
    public SellerApplicationResponseDTO getMine(Long userId) {
        return sellerApplicationRepository.findByUserId(userId)
                .map(this::toDTO)
                .orElse(null);
    }

    @Override
    public List<SellerApplicationResponseDTO> getAll(String status) {
        List<SellerApplication> applications;
        if (status == null || status.isBlank()) {
            applications = sellerApplicationRepository.findAllByOrderBySubmittedAtDesc();
        } else {
            SellerApplicationStatus st = SellerApplicationStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            applications = sellerApplicationRepository.findByStatusOrderBySubmittedAtDesc(st);
        }
        return applications.stream().map(this::toDTO).collect(Collectors.toList());
    }

        @Override
        @Transactional
        public SellerApplicationResponseDTO startReview(Long adminId, Long applicationId) {
        SellerApplication app = sellerApplicationRepository.findById(applicationId)
            .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ đăng ký"));
        Users admin = userRepository.findById(adminId)
            .orElseThrow(() -> new RuntimeException("Không tìm thấy admin"));

        if (app.getStatus() == SellerApplicationStatus.SUBMITTED) {
            app.setStatus(SellerApplicationStatus.UNDER_REVIEW);
            app.setReviewedBy(admin);
            app.setReviewedAt(LocalDateTime.now());
            app.setReviewNote(null);

            SellerApplication saved = sellerApplicationRepository.save(app);
            notificationService.send(
                app.getUser().getId(),
                "Hồ sơ người bán đang được xử lý",
                "Admin đã bắt đầu xử lý hồ sơ của bạn. Vui lòng chờ kết quả duyệt.",
                NotificationType.SYSTEM,
                app.getId()
            );
            sendEmailAsync(
                app.getContactEmail(),
                "[Hoa Quả Sơn] Hồ sơ đăng ký người bán đang được xử lý",
                "Chào bạn,\n\nHồ sơ đăng ký người bán của bạn đang được admin xử lý.\nChúng tôi sẽ gửi kết quả duyệt sớm nhất.\n\nTrân trọng,\nHoa Quả Sơn"
            );
            return toDTO(saved);
        }

        return toDTO(app);
        }

    @Override
    @Transactional
    public SellerApplicationResponseDTO review(Long adminId, Long applicationId, String action, String note) {
        SellerApplication app = sellerApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ đăng ký"));
        Users admin = userRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy admin"));

        String normalizedAction = Optional.ofNullable(action).orElse("").trim().toUpperCase(Locale.ROOT);
        switch (normalizedAction) {
            case "APPROVE" -> {
                app.setStatus(SellerApplicationStatus.APPROVED);
                ensureSellerRole(app.getUser());
                notificationService.send(
                        app.getUser().getId(),
                        "Hồ sơ người bán đã được duyệt",
                        "Chúc mừng! Bạn đã được cấp quyền người bán và có thể đăng sản phẩm ngay.",
                        NotificationType.SYSTEM,
                        app.getId()
                );
                    sendEmailAsync(
                        app.getContactEmail(),
                        "[Hoa Quả Sơn] Hồ sơ người bán đã được phê duyệt.",
                        "Chúc mừng!\n\nHồ sơ người bán của bạn đã được phê duyệt. Bạn có thể đăng sản phẩm ngay bây giờ.\n\nTrân trọng,\nHoa Quả Sơn"
                    );
            }
            case "REJECT" -> {
                app.setStatus(SellerApplicationStatus.REJECTED);
                notificationService.send(
                        app.getUser().getId(),
                        "Hồ sơ người bán bị từ chối",
                        "Hồ sơ đăng ký người bán chưa được duyệt. Vui lòng xem ghi chú và gửi lại.",
                        NotificationType.SYSTEM,
                        app.getId()
                );
                    sendEmailAsync(
                        app.getContactEmail(),
                        "[Hoa Quả Sơn] Hồ sơ người bán bị từ chối",
                        "Chào bạn,\n\nHồ sơ đăng ký người bán của bạn hiện chưa được duyệt.\nGhi chú: " + Optional.ofNullable(trimOrNull(note)).orElse("Không có") + "\n\nBạn có thể cập nhật và gửi lại hồ sơ.\n\nTrân trọng,\nHoa Quả Sơn"
                    );
            }
            default -> throw new RuntimeException("Hành động duyệt không hợp lệ. Dùng APPROVE hoặc REJECT");
        }

        app.setReviewNote(trimOrNull(note));
        app.setReviewedBy(admin);
        app.setReviewedAt(LocalDateTime.now());

        return toDTO(sellerApplicationRepository.save(app));
    }

    private void sendEmailAsync(String to, String subject, String body) {
        if (isBlank(to)) {
            return;
        }
        CompletableFuture.runAsync(() -> emailService.sendEmail(to.trim(), subject, body));
    }

    private void ensureSellerRole(Users user) {
        boolean alreadySeller = user.getRoles().stream().anyMatch(r -> "SELLER".equalsIgnoreCase(r.getRoleName()));
        if (alreadySeller) {
            return;
        }
        Role sellerRole = roleRepository.findByRoleName("SELLER").orElseGet(() -> {
            Role role = new Role();
            role.setRoleName("SELLER");
            return roleRepository.save(role);
        });
        user.getRoles().add(sellerRole);
        userRepository.save(user);
    }

    private void validateBusinessFields(SellerApplicationSubmitRequestDTO request) {
        if (!Boolean.TRUE.equals(request.getAgreedToTerms())) {
            throw new RuntimeException("Bạn cần đồng ý điều khoản trước khi gửi hồ sơ");
        }

        if (isBlank(request.getTaxCode())) {
            throw new RuntimeException("Vui lòng nhập mã số thuế phù hợp với loại hình kinh doanh");
        }

        String documentType = Optional.ofNullable(request.getFoodSafetyDocumentType()).orElse("").trim().toUpperCase(Locale.ROOT);
        String documentUrl = trimOrNull(request.getFoodSafetyDocumentUrl());
        if (isBlank(documentUrl)) {
            throw new RuntimeException("Vui lòng tải lên tài liệu chứng nhận/cam kết an toàn thực phẩm");
        }

        if (request.getSellerType() == SellerType.BUSINESS) {
            if (isBlank(request.getTaxCode()) || isBlank(request.getBusinessName()) || isBlank(request.getBusinessAddress()) || isBlank(request.getBusinessLicenseUrl())) {
                throw new RuntimeException("Hồ sơ doanh nghiệp cần đầy đủ MST, tên doanh nghiệp, địa chỉ và giấy phép kinh doanh");
            }
            if (!FOOD_SAFETY_CERTIFICATE.equals(documentType)) {
                throw new RuntimeException("Doanh nghiệp bắt buộc nộp Giấy chứng nhận ATTP");
            }
            return;
        }

        if (request.getSellerType() == SellerType.INDIVIDUAL) {
            if (!FOOD_SAFETY_CERTIFICATE.equals(documentType) && !FOOD_SAFETY_COMMITMENT.equals(documentType)) {
                throw new RuntimeException("Cá nhân cần chọn Giấy chứng nhận ATTP hoặc Bản cam kết sản xuất an toàn thực phẩm");
            }
        }
    }

    private void validatePickupAddress(SellerApplicationSubmitRequestDTO request) {
        if (request.getPickupGhnProvinceId() == null || request.getPickupGhnProvinceId() <= 0) {
            throw new RuntimeException("Mã tỉnh/thành GHN không hợp lệ");
        }
        if (request.getPickupGhnDistrictId() == null || request.getPickupGhnDistrictId() <= 0) {
            throw new RuntimeException("Mã quận/huyện GHN không hợp lệ");
        }
        if (isBlank(request.getPickupGhnWardCode())) {
            throw new RuntimeException("Mã phường/xã GHN không hợp lệ");
        }
    }

    private String buildPickupAddressLine(String streetDetail, String ward, String district, String province) {
        StringBuilder sb = new StringBuilder();
        if (!isBlank(streetDetail)) {
            sb.append(streetDetail.trim()).append(", ");
        }
        sb.append(ward.trim()).append(", ")
                .append(district.trim()).append(", ")
                .append(province.trim());
        return sb.toString();
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalizeFoodSafetyDocumentType(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private SellerApplicationResponseDTO toDTO(SellerApplication app) {
        SellerApplicationResponseDTO dto = new SellerApplicationResponseDTO();
        dto.setId(app.getId());
        dto.setUserId(app.getUser() != null ? app.getUser().getId() : null);
        dto.setUserEmail(app.getUser() != null ? app.getUser().getEmail() : null);
        dto.setShopName(app.getShopName());
        dto.setContactEmail(app.getContactEmail());
        dto.setContactPhone(app.getContactPhone());
        dto.setPickupAddress(app.getPickupAddress());
        if (app.getUser() != null && app.getUser().getAddress() != null) {
            Address address = app.getUser().getAddress();
            dto.setPickupProvince(address.getProvince() != null ? address.getProvince().getName() : null);
            dto.setPickupDistrict(address.getDistrict() != null ? address.getDistrict().getName() : null);
            dto.setPickupWard(address.getWard() != null ? address.getWard().getName() : null);
            dto.setPickupStreetDetail(address.getStreetDetail());
            dto.setPickupGhnProvinceId(address.getGhnProvinceId());
            dto.setPickupGhnDistrictId(address.getGhnDistrictId());
            dto.setPickupGhnWardCode(address.getGhnWardCode());
        }
        dto.setShippingProvider(app.getShippingProvider());
        dto.setSellerType(app.getSellerType());
        dto.setTaxCode(app.getTaxCode());
        dto.setBusinessName(app.getBusinessName());
        dto.setBusinessAddress(app.getBusinessAddress());
        dto.setBusinessLicenseUrl(app.getBusinessLicenseUrl());
        dto.setFoodSafetyDocumentType(app.getFoodSafetyDocumentType());
        dto.setFoodSafetyDocumentUrl(app.getFoodSafetyDocumentUrl());
        dto.setIdentityFullName(app.getIdentityFullName());
        dto.setIdentityNumber(app.getIdentityNumber());
        dto.setIdentityIssueDate(app.getIdentityIssueDate());
        dto.setIdentityIssuePlace(app.getIdentityIssuePlace());
        dto.setIdCardFrontUrl(app.getIdCardFrontUrl());
        dto.setIdCardBackUrl(app.getIdCardBackUrl());
        dto.setAgreedToTerms(app.getAgreedToTerms());
        dto.setStatus(app.getStatus() != null ? app.getStatus().name() : null);
        dto.setReviewNote(app.getReviewNote());
        dto.setSubmittedAt(app.getSubmittedAt());
        dto.setReviewedAt(app.getReviewedAt());
        dto.setCreatedAt(app.getCreatedAt());
        dto.setUpdatedAt(app.getUpdatedAt());
        return dto;
    }
}