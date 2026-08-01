-- Migración para Cuentas Corrientes

-- 1. Agregar estado y monto pagado a sales
ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending'));
ALTER TABLE sales ADD COLUMN paid_amount NUMERIC NOT NULL DEFAULT 0;

-- 2. Agregar estado a financial_movements
ALTER TABLE financial_movements ADD COLUMN status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending'));

-- 3. Tabla para registrar los pagos parciales
CREATE TABLE IF NOT EXISTS account_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_payments" ON account_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Actualizar la vista vw_sales_details para incluir s.status
DROP VIEW IF EXISTS vw_sales_details;
CREATE OR REPLACE VIEW vw_sales_details AS
SELECT 
  s.id AS sale_id,
  s.date AS sale_date,
  s.sale_number,
  s.status AS status,
  im.partner_id,
  p.name AS partner_name,
  pr.name AS product_name,
  pr.id AS product_id,
  im.quantity AS sold_quantity,
  si.unit_price AS sale_price,
  pl.cost_price,
  (im.quantity * si.unit_price) AS total_revenue,
  (im.quantity * (si.unit_price - pl.cost_price)) AS net_profit
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN inventory_movements im ON im.product_id = si.product_id 
     AND im.type = 'OUT' 
     AND im.reason = 'Venta #' || s.id::text
JOIN product_lots pl ON pl.id = im.lot_id
JOIN partners p ON p.id = im.partner_id
JOIN products pr ON pr.id = si.product_id;

-- 5. Actualizar rpc_process_sale para manejar status pending
CREATE OR REPLACE FUNCTION rpc_process_sale(
  p_seller_id      UUID,
  p_customer_id    UUID,
  p_payment_method TEXT,
  p_items          JSONB
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
  v_status      TEXT := 'paid';
  v_paid_amount NUMERIC := 0;
BEGIN
  IF p_payment_method = 'Cuenta Corriente' THEN
    v_status := 'pending';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  IF v_status = 'paid' THEN
    v_paid_amount := v_total;
  END IF;

  INSERT INTO sales (seller_id, customer_id, payment_method, total_amount, status, paid_amount)
  VALUES (p_seller_id, p_customer_id, p_payment_method, v_total, v_status, v_paid_amount)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INT;
    v_sale_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
    VALUES (v_sale_id, v_product_id, v_quantity, v_sale_price, v_quantity * v_sale_price);

    v_remaining := v_quantity;

    FOR v_lot IN
      SELECT id, partner_id, quantity, cost_price
      FROM product_lots
      WHERE product_id = v_product_id AND quantity > 0
      ORDER BY created_at ASC
    LOOP
      EXIT WHEN v_remaining = 0;

      v_deduct := LEAST(v_remaining, v_lot.quantity);

      UPDATE product_lots SET quantity = quantity - v_deduct WHERE id = v_lot.id;

      INSERT INTO inventory_movements (product_id, lot_id, partner_id, type, quantity, reason)
      VALUES (v_product_id, v_lot.id, v_lot.partner_id, 'OUT', v_deduct, 'Venta #' || v_sale_id);

      v_cost_price := v_lot.cost_price;
      v_profit     := v_deduct * (v_sale_price - v_cost_price);

      INSERT INTO financial_movements (partner_id, type, amount, related_id, status)
      VALUES (v_lot.partner_id, 'profit', v_profit, v_sale_id, v_status);

      v_remaining := v_remaining - v_deduct;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', v_product_id;
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$;

-- 6. Crear RPC para registrar pagos parciales/totales
CREATE OR REPLACE FUNCTION rpc_register_partial_payment(
  p_sale_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_new_paid NUMERIC;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  IF v_sale.status = 'paid' THEN
    RAISE EXCEPTION 'La venta ya está pagada';
  END IF;

  v_new_paid := v_sale.paid_amount + p_amount;
  
  IF v_new_paid > v_sale.total_amount THEN
    RAISE EXCEPTION 'El monto supera la deuda total';
  END IF;

  INSERT INTO account_payments (sale_id, amount) VALUES (p_sale_id, p_amount);
  UPDATE sales SET paid_amount = v_new_paid WHERE id = p_sale_id;

  IF v_new_paid = v_sale.total_amount THEN
    UPDATE sales SET status = 'paid' WHERE id = p_sale_id;
    UPDATE financial_movements SET status = 'paid' WHERE related_id = p_sale_id AND type = 'profit';
  END IF;
END;
$$;
