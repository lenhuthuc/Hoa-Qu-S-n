-- Seed roles
INSERT IGNORE INTO roles (id, role_name) VALUES (1, 'USER'), (2, 'ADMIN'), (3, 'SELLER');

-- Seed payment methods
INSERT IGNORE INTO payment_method (id, method_name) VALUES (1, 'COD'), (2, 'VNPAY');

-- Seed categories (parent categories)
INSERT IGNORE INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(1, 'Trái cây', 'trai-cay', NULL, '🍎', 1),
(2, 'Rau củ', 'rau-cu', NULL, '🥬', 2),
(3, 'Thảo mộc', 'thao-moc', NULL, '🌿', 3),
(4, 'Hạt & Ngũ cốc', 'hat-ngu-coc', NULL, '🌾', 4),
(5, 'Nấm', 'nam', NULL, '🍄', 5);

-- Seed sub-categories (Trái cây)
INSERT IGNORE INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(10, 'Trái cây nhiệt đới', 'trai-cay-nhiet-doi', 1, NULL, 1),
(11, 'Cam quýt', 'cam-quyt', 1, NULL, 2),
(12, 'Dưa các loại', 'dua-cac-loai', 1, NULL, 3),
(13, 'Trái cây nhập khẩu', 'trai-cay-nhap-khau', 1, NULL, 4);

-- Seed sub-categories (Rau củ)
INSERT IGNORE INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(20, 'Rau lá', 'rau-la', 2, NULL, 1),
(21, 'Củ quả', 'cu-qua', 2, NULL, 2),
(22, 'Rau gia vị', 'rau-gia-vi', 2, NULL, 3);

-- Seed sub-categories (Hạt & Ngũ cốc)
INSERT IGNORE INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(30, 'Gạo', 'gao', 4, NULL, 1),
(31, 'Đậu các loại', 'dau-cac-loai', 4, NULL, 2),
(32, 'Hạt dinh dưỡng', 'hat-dinh-duong', 4, NULL, 3);
