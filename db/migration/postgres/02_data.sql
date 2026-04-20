-- Seed categories (parent categories)
INSERT INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(1, 'Trái cây', 'trai-cay', NULL, '🍎', 1),
(2, 'Rau củ', 'rau-cu', NULL, '🥬', 2),
(3, 'Thảo mộc', 'thao-moc', NULL, '🌿', 3),
(4, 'Hạt & Ngũ cốc', 'hat-ngu-coc', NULL, '🌾', 4),
(5, 'Nấm', 'nam', NULL, '🍄', 5)
ON CONFLICT (id) DO NOTHING;

-- Seed sub-categories (Trái cây)
INSERT INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(10, 'Trái cây nhiệt đới', 'trai-cay-nhiet-doi', 1, NULL, 1),
(11, 'Cam quýt', 'cam-quyt', 1, NULL, 2),
(12, 'Dưa các loại', 'dua-cac-loai', 1, NULL, 3),
(13, 'Trái cây nhập khẩu', 'trai-cay-nhap-khau', 1, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Seed sub-categories (Rau củ)
INSERT INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(20, 'Rau lá', 'rau-la', 2, NULL, 1),
(21, 'Củ quả', 'cu-qua', 2, NULL, 2),
(22, 'Rau gia vị', 'rau-gia-vi', 2, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- Seed sub-categories (Hạt & Ngũ cốc)
INSERT INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(30, 'Gạo', 'gao', 4, NULL, 1),
(31, 'Đậu các loại', 'dau-cac-loai', 4, NULL, 2),
(32, 'Hạt dinh dưỡng', 'hat-dinh-duong', 4, NULL, 3)
ON CONFLICT (id) DO NOTHING;

-- Seed provinces
INSERT INTO provinces (code, name, type) VALUES
('01', 'Thành phố Hà Nội', 'Thành phố Trung ương'),
('02', 'Tỉnh Hà Giang', 'Tỉnh'),
('04', 'Tỉnh Cao Bằng', 'Tỉnh'),
('06', 'Tỉnh Bắc Kạn', 'Tỉnh'),
('08', 'Tỉnh Tuyên Quang', 'Tỉnh'),
('10', 'Tỉnh Lào Cai', 'Tỉnh'),
('11', 'Tỉnh Điện Biên', 'Tỉnh'),
('12', 'Tỉnh Lai Châu', 'Tỉnh'),
('14', 'Tỉnh Sơn La', 'Tỉnh'),
('15', 'Tỉnh Yên Bái', 'Tỉnh'),
('17', 'Tỉnh Hòa Bình', 'Tỉnh'),
('19', 'Tỉnh Thái Nguyên', 'Tỉnh'),
('20', 'Tỉnh Lạng Sơn', 'Tỉnh'),
('22', 'Tỉnh Quảng Ninh', 'Tỉnh'),
('24', 'Tỉnh Bắc Giang', 'Tỉnh'),
('25', 'Tỉnh Phú Thọ', 'Tỉnh'),
('26', 'Tỉnh Vĩnh Phúc', 'Tỉnh'),
('27', 'Tỉnh Bắc Ninh', 'Tỉnh'),
('30', 'Tỉnh Hải Dương', 'Tỉnh'),
('31', 'Thành phố Hải Phòng', 'Thành phố Trung ương'),
('33', 'Tỉnh Hưng Yên', 'Tỉnh'),
('34', 'Tỉnh Thái Bình', 'Tỉnh'),
('35', 'Tỉnh Hà Nam', 'Tỉnh'),
('36', 'Tỉnh Nam Định', 'Tỉnh'),
('37', 'Tỉnh Ninh Bình', 'Tỉnh'),
('38', 'Tỉnh Thanh Hóa', 'Tỉnh'),
('40', 'Tỉnh Nghệ An', 'Tỉnh'),
('42', 'Tỉnh Hà Tĩnh', 'Tỉnh'),
('44', 'Tỉnh Quảng Bình', 'Tỉnh'),
('45', 'Tỉnh Quảng Trị', 'Tỉnh'),
('46', 'Tỉnh Thừa Thiên Huế', 'Tỉnh'),
('48', 'Thành phố Đà Nẵng', 'Thành phố Trung ương'),
('49', 'Tỉnh Quảng Nam', 'Tỉnh'),
('51', 'Tỉnh Quảng Ngãi', 'Tỉnh'),
('52', 'Tỉnh Bình Định', 'Tỉnh'),
('54', 'Tỉnh Phú Yên', 'Tỉnh'),
('56', 'Tỉnh Khánh Hòa', 'Tỉnh'),
('58', 'Tỉnh Ninh Thuận', 'Tỉnh'),
('60', 'Tỉnh Bình Thuận', 'Tỉnh'),
('62', 'Tỉnh Kon Tum', 'Tỉnh'),
('64', 'Tỉnh Gia Lai', 'Tỉnh'),
('66', 'Tỉnh Đắk Lắk', 'Tỉnh'),
('67', 'Tỉnh Đắk Nông', 'Tỉnh'),
('68', 'Tỉnh Lâm Đồng', 'Tỉnh'),
('70', 'Tỉnh Bình Phước', 'Tỉnh'),
('72', 'Tỉnh Tây Ninh', 'Tỉnh'),
('74', 'Tỉnh Bình Dương', 'Tỉnh'),
('75', 'Tỉnh Đồng Nai', 'Tỉnh'),
('77', 'Tỉnh Bà Rịa - Vũng Tàu', 'Tỉnh'),
('79', 'Thành phố Hồ Chí Minh', 'Thành phố Trung ương'),
('80', 'Tỉnh Long An', 'Tỉnh'),
('82', 'Tỉnh Tiền Giang', 'Tỉnh'),
('83', 'Tỉnh Bến Tre', 'Tỉnh'),
('84', 'Tỉnh Trà Vinh', 'Tỉnh'),
('86', 'Tỉnh Vĩnh Long', 'Tỉnh'),
('87', 'Tỉnh Đồng Tháp', 'Tỉnh'),
('89', 'Tỉnh An Giang', 'Tỉnh'),
('91', 'Tỉnh Kiên Giang', 'Tỉnh'),
('92', 'Thành phố Cần Thơ', 'Thành phố Trung ương'),
('93', 'Tỉnh Hậu Giang', 'Tỉnh'),
('94', 'Tỉnh Sóc Trăng', 'Tỉnh'),
('95', 'Tỉnh Bạc Liêu', 'Tỉnh'),
('96', 'Tỉnh Cà Mau', 'Tỉnh')
ON CONFLICT (code) DO NOTHING;

-- Seed districts (Sample for Hanoi, HCMC, Da Nang)
INSERT INTO districts (code, name, type, province_code) VALUES
('001', 'Quận Ba Đình', 'Quận', '01'),
('002', 'Quận Hoàn Kiếm', 'Quận', '01'),
('003', 'Quận Tây Hồ', 'Quận', '01'),
('004', 'Quận Long Biên', 'Quận', '01'),
('005', 'Quận Cầu Giấy', 'Quận', '01'),
('006', 'Quận Đống Đa', 'Quận', '01'),

('760', 'Quận 1', 'Quận', '79'),
('761', 'Quận 12', 'Quận', '79'),
('764', 'Quận Gò Vấp', 'Quận', '79'),
('765', 'Quận Bình Thạnh', 'Quận', '79'),
('766', 'Quận Tân Bình', 'Quận', '79'),
('769', 'Thành phố Thủ Đức', 'Thành phố', '79'),

('490', 'Quận Liên Chiểu', 'Quận', '48'),
('491', 'Quận Thanh Khê', 'Quận', '48'),
('492', 'Quận Hải Châu', 'Quận', '48'),
('493', 'Quận Sơn Trà', 'Quận', '48'),
('494', 'Quận Ngũ Hành Sơn', 'Quận', '48'),
('495', 'Quận Cẩm Lệ', 'Quận', '48')
ON CONFLICT (code) DO NOTHING;

-- Seed wards (Sample for Ba Dinh, Quan 1, Hai Chau)
INSERT INTO wards (code, name, type, district_code) VALUES
('00001', 'Phường Phúc Xá', 'Phường', '001'),
('00004', 'Phường Trúc Bạch', 'Phường', '001'),
('00007', 'Phường Vĩnh Phúc', 'Phường', '001'),
('00010', 'Phường Cống Vị', 'Phường', '001'),

('26734', 'Phường Bến Nghé', 'Phường', '760'),
('26737', 'Phường Bến Thành', 'Phường', '760'),
('26740', 'Phường Cô Giang', 'Phường', '760'),
('26743', 'Phường Cầu Ông Lãnh', 'Phường', '760'),

('20194', 'Phường Hải Châu I', 'Phường', '492'),
('20195', 'Phường Hải Châu II', 'Phường', '492'),
('20197', 'Phường Thạch Thang', 'Phường', '492'),
('20200', 'Phường Thanh Bình', 'Phường', '492')
ON CONFLICT (code) DO NOTHING;

-- Seed more diverse categories
INSERT INTO categories (id, name, slug, parent_id, icon, sort_order) VALUES
(6, 'Thịt & Thủy sản', 'thit-thuy-san', NULL, '🥩', 6),
(7, 'Gia vị & Đồ khô', 'gia-vi', NULL, '🧂', 7),
(8, 'Đặc sản vùng miền', 'dac-san', NULL, '🎁', 8),
(9, 'Đồ uống & Trà', 'do-uong', NULL, '🍵', 9),
(60, 'Thịt Heo', 'thit-heo', 6, NULL, 1),
(61, 'Thịt Bò', 'thit-bo', 6, NULL, 2),
(62, 'Hải Sản Tươi Sống', 'hai-san', 6, NULL, 3),
(70, 'Nước Mắm', 'nuoc-mam', 7, NULL, 1),
(71, 'Gia Vị Tổng Hợp', 'gia-vi-tong-hop', 7, NULL, 2),
(80, 'Đặc Sản Tây Bắc', 'dac-san-tay-bac', 8, NULL, 1),
(81, 'Đặc Sản Miền Tây', 'dac-san-mien-tay', 8, NULL, 2)
ON CONFLICT (id) DO NOTHING;
