/**
 * Wrapper & Mapper for Pulso E-Commerce API integration.
 * Isolates external API schema and HTTP transport from UI and hooks.
 *
 * Pulso Pydantic constraints:
 * - sku: string (1..60 chars)
 * - name: string (3..120 chars)
 * - price: number (> 0)
 * - stock: integer (>= 0)
 * - brand: optional string (<= 60 chars)
 */

function formatErrorMessage(errorPayload, fallbackMessage) {
  if (!errorPayload) return fallbackMessage;
  if (typeof errorPayload === 'string') return errorPayload;
  if (Array.isArray(errorPayload)) {
    return errorPayload
      .map(item => {
        const field = Array.isArray(item?.loc) ? item.loc.slice(1).join('.') : '';
        return field ? `${field}: ${item.msg}` : item?.msg || JSON.stringify(item);
      })
      .join(' | ');
  }
  if (typeof errorPayload === 'object') {
    return errorPayload.message || errorPayload.detail || JSON.stringify(errorPayload);
  }
  return fallbackMessage;
}

export function resolveProductSku(product) {
  const rawSku = product?.barcode || product?.sku || product?.id || '';
  return String(rawSku).trim().slice(0, 60);
}

export function mapProductToPulsoPayload(product) {
  const sku = resolveProductSku(product);
  const rawName = String(product?.name || '').trim();
  const normalizedName =
    rawName.length > 0 && rawName.length < 3
      ? rawName.padEnd(3, '.')
      : rawName.slice(0, 120);

  const cleanPrice = Number(product?.sale_price) || 0;
  const cleanStock = Math.max(0, parseInt(product?.stock, 10) || 0);

  const payload = {
    sku,
    name: normalizedName,
    price: cleanPrice,
    stock: cleanStock
  };

  if (product?.description && String(product.description).trim()) {
    payload.description = String(product.description).trim().slice(0, 1000);
  }
  if (product?.brand && String(product.brand).trim()) {
    payload.brand = String(product.brand).trim().slice(0, 60);
  }

  return payload;
}

export async function fetchPulsoMerchantStatus() {
  const response = await fetch('/api/pulso', { method: 'GET' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      formatErrorMessage(data?.error, 'No se pudo verificar la conexión con Pulso.')
    );
  }

  return data;
}

export async function syncCatalogWithPulso(products, { onlyInStock = true, pauseMissing = true } = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No hay productos para sincronizar con Pulso.');
  }

  const seenSkus = new Set();
  const eligibleProducts = [];

  for (const product of products) {
    const isActive = product.active !== false;
    const hasStock = (Number(product.stock) || 0) > 0;
    if (!isActive || (onlyInStock && !hasStock)) {
      continue;
    }

    const mapped = mapProductToPulsoPayload(product);
    if (!mapped.sku || mapped.name.length < 3 || mapped.price <= 0) {
      continue;
    }

    let uniqueSku = mapped.sku;
    if (seenSkus.has(uniqueSku) && product.id) {
      const suffix = `-${String(product.id).slice(0, 6)}`;
      uniqueSku = `${uniqueSku.slice(0, 60 - suffix.length)}${suffix}`;
    }
    seenSkus.add(uniqueSku);

    eligibleProducts.push({
      ...mapped,
      sku: uniqueSku
    });
  }

  if (eligibleProducts.length === 0) {
    throw new Error('No hay productos válidos (con stock > 0 y precio de venta > 0) para publicar en Pulso.');
  }

  const response = await fetch('/api/pulso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: eligibleProducts,
      pause_missing: pauseMissing
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      formatErrorMessage(data?.error, 'Error al sincronizar el catálogo con Pulso.')
    );
  }

  return data;
}

export async function syncSingleProductWithPulso(product) {
  const mapped = mapProductToPulsoPayload(product);
  if (!mapped.sku || mapped.name.length < 3 || mapped.price <= 0) return null;

  const response = await fetch('/api/pulso', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: [mapped],
      pause_missing: false
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      formatErrorMessage(data?.error, 'Error al actualizar el producto en Pulso.')
    );
  }

  return data;
}

export async function pauseProductInPulso(sku) {
  const cleanSku = String(sku || '').trim().slice(0, 60);
  if (!cleanSku) return null;

  const response = await fetch(`/api/pulso?sku=${encodeURIComponent(cleanSku)}`, {
    method: 'DELETE'
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      formatErrorMessage(data?.error, 'Error al pausar el producto en Pulso.')
    );
  }

  return data;
}

/**
 * Fetches fresh product & stock data from Supabase for the given product IDs
 * and pushes their updated price/stock to Pulso in the background.
 */
export async function syncProductsByIdsWithPulso(productIds = []) {
  const uniqueIds = [...new Set((productIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return null;

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('products')
      .select('*, product_lots(quantity)')
      .in('id', uniqueIds);

    if (error || !data || data.length === 0) return null;

    const mappedProducts = data
      .map(product => {
        const totalStock =
          product.product_lots?.reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0) || 0;
        return mapProductToPulsoPayload({
          ...product,
          stock: product.active === false ? 0 : totalStock
        });
      })
      .filter(item => item.sku && item.name.length >= 3 && item.price > 0);

    if (mappedProducts.length === 0) return null;

    const response = await fetch('/api/pulso', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: mappedProducts,
        pause_missing: false
      })
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Non-blocking background sync: never break local POS/inventory transactions
    return null;
  }
}
