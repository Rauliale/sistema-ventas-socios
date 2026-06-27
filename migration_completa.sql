-- =====================================================================
-- SCRIPT DE MIGRACIÓN COMPLETO - Sistema de Gestión de Ventas y Socios
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: frpxhamwltigaznirgqr
-- =====================================================================

-- 1. TIPO ENUMERADO DE ROL
CREATE TYPE role_type AS ENUM ('admin', 'vendedor');

-- 2. SECUENCIA PARA NÚMERO DE VENTA
CREATE SEQUENCE IF NOT EXISTS sales_sale_number_seq START 1;

-- =====================================================================
-- TABLAS BASE
-- =====================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        role_type NOT NULL DEFAULT 'vendedor',
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  observations TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode     TEXT UNIQUE,
  sku         TEXT UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  brand       TEXT,
  cost_price  NUMERIC NOT NULL DEFAULT 0,
  sale_price  NUMERIC NOT NULL DEFAULT 0,
  min_stock   INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- LOTES (FIFO por socio)
-- =====================================================================

CREATE TABLE IF NOT EXISTS product_lots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  partner_id UUID NOT NULL REFERENCES partners(id),
  quantity   INT NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- COMPRAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES partners(id),
  supplier_id    UUID REFERENCES suppliers(id),
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount   NUMERIC NOT NULL DEFAULT 0,
  invoice_number TEXT,
  observations   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL DEFAULT 0,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- VENTAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS sales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES profiles(id),
  customer_id    UUID REFERENCES customers(id),
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount   NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  sale_number    INT UNIQUE DEFAULT nextval('sales_sale_number_seq'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL DEFAULT 0,
  unit_price  NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- GASTOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount      NUMERIC NOT NULL DEFAULT 0,
  receipt_url TEXT,
  date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  shared_type TEXT NOT NULL DEFAULT '50/50',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- MOVIMIENTOS FINANCIEROS (Libro contable por socio)
-- =====================================================================

CREATE TABLE IF NOT EXISTS financial_movements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  type       TEXT NOT NULL CHECK (type IN ('investment','profit','expense','withdrawal')),
  amount     NUMERIC NOT NULL DEFAULT 0,
  date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- MOVIMIENTOS DE INVENTARIO (auditoría de stock)
-- =====================================================================

CREATE TABLE IF NOT EXISTS inventory_movements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id     UUID REFERENCES product_lots(id),
  partner_id UUID NOT NULL REFERENCES partners(id),
  type       TEXT NOT NULL CHECK (type IN ('IN','OUT')),
  quantity   INT NOT NULL DEFAULT 0,
  reason     TEXT,
  date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- AUDITORÍA
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id),
  action       TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id    UUID,
  old_data     JSONB,
  new_data     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================

INSERT INTO partners (name) VALUES ('Raúl'), ('Nahuel')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
  ('Alquiler'), ('Servicios'), ('Transporte'), ('Marketing'),
  ('Equipamiento'), ('Impuestos'), ('Sueldos'), ('Otros')
  ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- RPC: Procesar Venta (FIFO)
-- =====================================================================

CREATE OR REPLACE FUNCTION rpc_process_sale(
  p_seller_id      UUID,
  p_customer_id    UUID,
  p_payment_method TEXT,
  p_items          JSONB  -- [{product_id, quantity, unit_price}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id     UUID;
  v_total       NUMERIC := 0;
  v_item        JSONB;
  v_lot         RECORD;
  v_remaining   INT;
  v_deduct      INT;
  v_sale_price  NUMERIC;
  v_cost_price  NUMERIC;
  v_profit      NUMERIC;
  v_product_id  UUID;
  v_quantity    INT;
BEGIN
  -- 1. Calcular total de la venta
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  -- 2. Insertar cabecera de venta
  INSERT INTO sales (seller_id, customer_id, payment_method, total_amount)
  VALUES (p_seller_id, p_customer_id, p_payment_method, v_total)
  RETURNING id INTO v_sale_id;

  -- 3. Procesar cada ítem con FIFO
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INT;
    v_sale_price := (v_item->>'unit_price')::NUMERIC;

    -- Insertar ítem de venta
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, v_quantity, v_sale_price, v_quantity * v_sale_price);

    v_remaining := v_quantity;

    -- FIFO: consumir lotes ordenados por fecha de creación (más antiguo primero)
    FOR v_lot IN
      SELECT id, partner_id, quantity, cost_price
      FROM product_lots
      WHERE product_id = v_product_id AND quantity > 0
      ORDER BY created_at ASC
    LOOP
      EXIT WHEN v_remaining = 0;

      v_deduct := LEAST(v_remaining, v_lot.quantity);

      -- Descontar del lote
      UPDATE product_lots SET quantity = quantity - v_deduct WHERE id = v_lot.id;

      -- Registrar movimiento de inventario
      INSERT INTO inventory_movements (product_id, lot_id, partner_id, type, quantity, reason)
      VALUES (v_product_id, v_lot.id, v_lot.partner_id, 'OUT', v_deduct, 'Venta #' || v_sale_id);

      -- Calcular ganancia proporcional de este lote y asignar al socio
      v_cost_price := v_lot.cost_price;
      v_profit     := v_deduct * (v_sale_price - v_cost_price);

      INSERT INTO financial_movements (partner_id, type, amount, related_id)
      VALUES (v_lot.partner_id, 'profit', v_profit, v_sale_id);

      v_remaining := v_remaining - v_deduct;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', v_product_id;
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$;

-- =====================================================================
-- RPC: Procesar Compra
-- =====================================================================

CREATE OR REPLACE FUNCTION rpc_process_purchase(
  p_partner_id     UUID,
  p_supplier_id    UUID,
  p_invoice_number TEXT,
  p_observations   TEXT,
  p_items          JSONB  -- [{product_id, quantity, unit_price}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase_id UUID;
  v_total       NUMERIC := 0;
  v_item        JSONB;
  v_lot_id      UUID;
  v_qty         INT;
  v_cost        NUMERIC;
  v_prod_id     UUID;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty   := (v_item->>'quantity')::INT;
    v_cost  := (v_item->>'unit_price')::NUMERIC;
    v_total := v_total + (v_qty * v_cost);
  END LOOP;

  INSERT INTO purchases (partner_id, supplier_id, invoice_number, observations, total_amount)
  VALUES (p_partner_id, p_supplier_id, p_invoice_number, p_observations, v_total)
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'product_id')::UUID;
    v_qty     := (v_item->>'quantity')::INT;
    v_cost    := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price)
    VALUES (v_purchase_id, v_prod_id, v_qty, v_cost);

    INSERT INTO product_lots (product_id, partner_id, quantity, cost_price)
    VALUES (v_prod_id, p_partner_id, v_qty, v_cost)
    RETURNING id INTO v_lot_id;

    INSERT INTO inventory_movements (product_id, lot_id, partner_id, type, quantity, reason)
    VALUES (v_prod_id, v_lot_id, p_partner_id, 'IN', v_qty, 'Compra #' || v_purchase_id);
  END LOOP;

  INSERT INTO financial_movements (partner_id, type, amount, related_id)
  VALUES (p_partner_id, 'investment', -v_total, v_purchase_id);

  RETURN v_purchase_id;
END;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: acceso total para usuarios autenticados
CREATE POLICY "auth_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON partners FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON product_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON financial_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- PR�STAMOS Y CUOTAS (AGENDA)
-- =====================================================================

CREATE TABLE IF NOT EXISTS loans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES partners(id),
  description    TEXT NOT NULL,
  total_amount   NUMERIC NOT NULL DEFAULT 0,
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_installments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id        UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL DEFAULT 0,
  due_date       DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_loans" ON loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_inst" ON loan_installments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION rpc_create_loan(
  p_partner_id      UUID,
  p_description     TEXT,
  p_total_amount    NUMERIC,
  p_installments    INT,
  p_installment_amt NUMERIC,
  p_first_due_date  DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan_id UUID;
  i INT;
  v_current_due_date DATE;
BEGIN
  INSERT INTO loans (partner_id, description, total_amount, date)
  VALUES (p_partner_id, p_description, p_total_amount, now())
  RETURNING id INTO v_loan_id;

  v_current_due_date := p_first_due_date;
  FOR i IN 1..p_installments LOOP
    INSERT INTO loan_installments (loan_id, amount, due_date, status)
    VALUES (v_loan_id, p_installment_amt, v_current_due_date, 'pending');
    
    v_current_due_date := v_current_due_date + interval '1 month';
  END LOOP;

  RETURN v_loan_id;
END;
$$;
