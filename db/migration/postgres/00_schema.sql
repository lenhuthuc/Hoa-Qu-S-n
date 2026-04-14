CREATE TABLE provinces (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  ghn_province_id INTEGER
);

CREATE TABLE districts (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  province_code VARCHAR(20) REFERENCES provinces(code),
  ghn_district_id INTEGER
);

CREATE TABLE wards (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  district_code VARCHAR(20) REFERENCES districts(code),
  ghn_ward_code VARCHAR(20)
);

CREATE TABLE addresses (
  id BIGSERIAL PRIMARY KEY,
  province_code VARCHAR(20), -- FK dropped for pragmatic reasons
  district_code VARCHAR(20), -- FK dropped for pragmatic reasons
  ward_code VARCHAR(20),     -- FK dropped for pragmatic reasons
  province_name VARCHAR(255),
  district_name VARCHAR(255),
  ward_name VARCHAR(255),
  street_detail VARCHAR(255),
  ghn_province_id INT,
  ghn_district_id INT,
  ghn_ward_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  phone VARCHAR(20),
  avatar VARCHAR(1000),
  address_id BIGINT REFERENCES addresses(id)
);

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE payment_method (
  id BIGSERIAL PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  icon VARCHAR(255),
  sort_order INT DEFAULT 0
);

CREATE TABLE product (
  id BIGSERIAL PRIMARY KEY,
  product_name VARCHAR(500) NOT NULL, 
  price DECIMAL(12, 2) NOT NULL,
  category VARCHAR(255),              
  image VARCHAR(1000),                
  description TEXT,                   
  rating_count INT DEFAULT 0,  
  rating DECIMAL(3,1) DEFAULT 0,
  quantity BIGINT DEFAULT 100        
);

CREATE TABLE cart (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id BIGINT NOT NULL REFERENCES payment_method(id),
  address_id BIGINT REFERENCES addresses(id),
  order_number VARCHAR(30),
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50),
  total_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoice (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  order_id BIGINT UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  total_price DECIMAL(12,2),
  payment_id BIGINT REFERENCES payment_method(id),
  created_at TIMESTAMPTZ
);

CREATE TABLE users_roles (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_payment_methods (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  payment_id BIGINT REFERENCES payment_method(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, payment_id)
);

CREATE TABLE cart_items (
  cart_id BIGINT REFERENCES cart(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES product(id) ON DELETE CASCADE,
  quantity BIGINT NOT NULL,
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  quantity BIGINT NOT NULL,
  price DECIMAL(12,2) NOT NULL
);

CREATE TABLE invoice_items (
  invoice_id BIGINT REFERENCES invoice(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES product(id) ON DELETE CASCADE,
  quantity BIGINT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (invoice_id, product_id)
);

CREATE TABLE review (
  id BIGSERIAL PRIMARY KEY,
  rating INT NOT NULL,
  content VARCHAR(255),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES product(id) ON DELETE CASCADE
);

CREATE TABLE user_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (role_name) VALUES ('USER'), ('ADMIN'), ('SELLER') ON CONFLICT(role_name) DO NOTHING;
INSERT INTO payment_method (method_name) VALUES ('COD'), ('VNPAY') ON CONFLICT(method_name) DO NOTHING;

CREATE OR REPLACE FUNCTION update_rating_after_review()
RETURNS TRIGGER AS $$
DECLARE
    new_rating DECIMAL(3,1);
    new_count INT;
BEGIN
    SELECT COUNT(*), COALESCE(AVG(rating),0)
    INTO new_count, new_rating
    FROM review
    WHERE product_id = NEW.product_id;
    
    UPDATE product
    SET rating = new_rating, rating_count = new_count
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating
AFTER INSERT ON review
FOR EACH ROW
EXECUTE FUNCTION update_rating_after_review();
