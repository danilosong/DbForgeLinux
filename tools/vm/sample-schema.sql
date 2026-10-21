-- Schema de exemplo para observar/comparar o dbForge original e o TuxSQL Song (dados 100% fictícios).
DROP DATABASE IF EXISTS sample;
CREATE DATABASE sample CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sample;
SET SESSION cte_max_recursion_depth = 200000;

CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, parent_id INT UNSIGNED NULL, name VARCHAR(80) NOT NULL,
  UNIQUE KEY uq_cat_name (parent_id, name),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) COMMENT='Categorias (auto-relacionamento)';

CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL,
  country CHAR(2) NOT NULL DEFAULT 'BR', status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  tags SET('vip','newsletter','beta') NULL, profile JSON NULL, avatar BLOB NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  email_domain VARCHAR(120) GENERATED ALWAYS AS (SUBSTRING_INDEX(email,'@',-1)) STORED,
  UNIQUE KEY uq_customer_email (email), KEY idx_customer_country_status (country, status), FULLTEXT KEY ft_customer_name (name)
);

CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, category_id INT UNSIGNED NOT NULL, sku VARCHAR(40) NOT NULL, name VARCHAR(160) NOT NULL,
  price DECIMAL(10,2) NOT NULL, stock INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_sku (sku), KEY idx_prod_cat (category_id), CHECK (price >= 0),
  CONSTRAINT fk_prod_cat FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'new',
  total DECIMAL(12,2) NOT NULL DEFAULT 0, ordered_at DATETIME NOT NULL, notes TEXT NULL,
  KEY idx_orders_customer (customer_id, ordered_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE order_items (
  order_id BIGINT UNSIGNED NOT NULL, line_no SMALLINT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, line_no), KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, table_name VARCHAR(64) NOT NULL, action VARCHAR(10) NOT NULL,
  row_id BIGINT NULL, changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE no_pk_table (a INT, b VARCHAR(20));  -- sem PK: grid deve abrir somente leitura

CREATE TABLE events_big (
  id BIGINT UNSIGNED AUTO_INCREMENT, created_on DATE NOT NULL, kind VARCHAR(20) NOT NULL, payload VARCHAR(200) NOT NULL,
  PRIMARY KEY (id, created_on)
) PARTITION BY RANGE COLUMNS (created_on) (
  PARTITION p2024 VALUES LESS THAN ('2025-01-01'), PARTITION p2025 VALUES LESS THAN ('2026-01-01'), PARTITION pmax VALUES LESS THAN (MAXVALUE)
);

-- Dados
INSERT INTO categories (id,parent_id,name) VALUES (1,NULL,'Eletrônicos'),(2,1,'Celulares'),(3,1,'Notebooks'),(4,NULL,'Casa'),(5,4,'Cozinha');
INSERT INTO products (category_id,sku,name,price,stock)
  WITH RECURSIVE n AS (SELECT 1 i UNION ALL SELECT i+1 FROM n WHERE i<200)
  SELECT 2+MOD(i,4), CONCAT('SKU-',LPAD(i,5,'0')), CONCAT('Produto ',i), ROUND(10+RAND(i)*990,2), MOD(i*7,500) FROM n;
INSERT INTO customers (name,email,country,status,tags,profile,balance,created_at)
  WITH RECURSIVE n AS (SELECT 1 i UNION ALL SELECT i+1 FROM n WHERE i<5000)
  SELECT CONCAT('Cliente ',i), CONCAT('cliente',i,'@exemplo.test'), ELT(1+MOD(i,4),'BR','US','PT','DE'),
         ELT(1+MOD(i,3),'active','inactive','blocked'), IF(MOD(i,5)=0,'vip,newsletter',NULL),
         JSON_OBJECT('nivel',MOD(i,10),'ativo',MOD(i,2)=0), ROUND(RAND(i)*5000,2), NOW() - INTERVAL MOD(i,900) DAY FROM n;
INSERT INTO orders (customer_id,status,total,ordered_at)
  WITH RECURSIVE n AS (SELECT 1 i UNION ALL SELECT i+1 FROM n WHERE i<20000)
  SELECT 1+MOD(i*13,5000), ELT(1+MOD(i,4),'new','paid','shipped','cancelled'), ROUND(20+RAND(i)*980,2), NOW() - INTERVAL MOD(i,700) DAY FROM n;
INSERT INTO order_items (order_id,line_no,product_id,quantity,unit_price)
  SELECT o.id, l.n, 1+MOD(o.id*l.n,200), 1+MOD(o.id+l.n,5), 10+MOD(o.id*l.n,90) FROM orders o JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3) l ON l.n <= 1+MOD(o.id,3);
INSERT INTO events_big (created_on,kind,payload)
  WITH RECURSIVE n AS (SELECT 1 i UNION ALL SELECT i+1 FROM n WHERE i<100000)
  SELECT DATE('2024-01-01') + INTERVAL MOD(i,900) DAY, ELT(1+MOD(i,4),'login','click','purchase','error'), CONCAT('payload-',i,'-',MD5(i)) FROM n;
INSERT INTO no_pk_table VALUES (1,'a'),(2,'b');

-- Objetos programáveis
CREATE VIEW v_customer_totals AS
  SELECT c.id, c.name, c.country, COUNT(o.id) AS orders, COALESCE(SUM(o.total),0) AS spent
  FROM customers c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id, c.name, c.country;

DELIMITER //
CREATE FUNCTION fn_discount(p_total DECIMAL(12,2)) RETURNS DECIMAL(12,2) DETERMINISTIC
BEGIN RETURN IF(p_total>=1000, p_total*0.9, p_total); END//

CREATE PROCEDURE sp_recalc_totals()
BEGIN
  DECLARE done INT DEFAULT 0; DECLARE v_id BIGINT; DECLARE v_sum DECIMAL(12,2);
  DECLARE cur CURSOR FOR SELECT order_id, SUM(quantity*unit_price) FROM order_items GROUP BY order_id LIMIT 200;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_id, v_sum;
    IF done THEN LEAVE read_loop; END IF;
    UPDATE orders SET total = v_sum WHERE id = v_id;
  END LOOP;
  CLOSE cur;
END//

CREATE PROCEDURE sp_customer_orders(IN p_customer INT UNSIGNED, OUT p_count INT)
BEGIN
  SELECT COUNT(*) INTO p_count FROM orders WHERE customer_id = p_customer;
  SELECT id, status, total, ordered_at FROM orders WHERE customer_id = p_customer ORDER BY ordered_at DESC LIMIT 20;
END//

CREATE TRIGGER trg_orders_ai AFTER INSERT ON orders FOR EACH ROW
  INSERT INTO audit_log (table_name, action, row_id) VALUES ('orders','INSERT',NEW.id)//
CREATE TRIGGER trg_customers_bu BEFORE UPDATE ON customers FOR EACH ROW
  SET NEW.email = LOWER(NEW.email)//
DELIMITER ;
CREATE EVENT ev_purge_audit ON SCHEDULE EVERY 1 DAY DISABLE DO DELETE FROM audit_log WHERE changed_at < NOW() - INTERVAL 30 DAY;

-- Usuários para Security Manager
CREATE USER IF NOT EXISTS 'app_ro'@'%' IDENTIFIED BY 'sample-only';
CREATE USER IF NOT EXISTS 'app_rw'@'%' IDENTIFIED BY 'sample-only';
GRANT SELECT ON sample.* TO 'app_ro'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON sample.* TO 'app_rw'@'%';
