-- 1. Agregar columna description a sale_items
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Crear producto comodín (Genérico) si no existe
INSERT INTO products (id, name, cost_price, sale_price, active, min_stock, barcode)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'Otros / Servicio', 
  0, 
  0, 
  TRUE, 
  0,
  '9999999999999'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Actualizar rpc_process_sale para manejar la descripción y saltar FIFO para el producto genérico
CREATE OR REPLACE FUNCTION rpc_process_sale(
  p_seller_id      UUID,
  p_customer_id    UUID,
  p_payment_method TEXT,
  p_items          JSONB  -- [{product_id, quantity, unit_price, description}]
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
  v_description TEXT;
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
    v_product_id  := (v_item->>'product_id')::UUID;
    v_quantity    := (v_item->>'quantity')::INT;
    v_sale_price  := (v_item->>'unit_price')::NUMERIC;
    v_description := v_item->>'description';

    -- Insertar ítem de venta, incluyendo la descripción (que puede ser NULL)
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price, description)
    VALUES (v_sale_id, v_product_id, v_quantity, v_sale_price, v_quantity * v_sale_price, v_description);

    -- Si es el producto genérico 'Otros / Servicio', saltar la validación de stock y FIFO.
    -- (Opcionalmente, si es cualquier producto que NO gestiona stock).
    IF v_product_id = '00000000-0000-0000-0000-000000000000' THEN
       CONTINUE;
    END IF;

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
