/**
 * Wrapper & Mapper for Pulso E-Commerce API integration.
 * Isolates external API schema and HTTP transport from UI and hooks.
 */

export function resolveProductSku(product) {
  const rawSku = product?.barcode || product?.sku || product?.id || '';
  return String(rawSku).trim();
}

export function mapProductToPulsoPayload(product) {
  const sku = resolveProductSku(product);
  const cleanPrice = Number(product?.sale_price) || 0;
  const cleanStock = Math.max(0, parseInt(product?.stock, 10) || 0);

  const payload = {
    sku,
    name: String(product?.name || '').trim(),
    price: cleanPrice,
    stock: cleanStock
  };

  if (product?.description) {
    payload.description = String(product.description).trim();
  }
  if (product?.brand) {
    payload.brand = String(product.brand).trim();
  }

  return payload;
}

export async function fetchPulsoMerchantStatus() {
  const response = await fetch('/api/pulso', { method: 'GET' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo verificar la conexión con Pulso.');
  }

  return data;
}

export async function syncCatalogWithPulso(products, { onlyInStock = true, pauseMissing = true } = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No hay productos para sincronizar con Pulso.');
  }

  const eligibleProducts = products
    .filter(product => {
      const isActive = product.active !== false;
      const hasStock = (Number(product.stock) || 0) > 0;
      return isActive && (!onlyInStock || hasStock);
    })
    .map(mapProductToPulsoPayload)
    .filter(item => item.sku && item.name);

  if (eligibleProducts.length === 0) {
    throw new Error('No hay productos válidos con stock para publicar en Pulso.');
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
    throw new Error(data?.error || 'Error al sincronizar el catálogo con Pulso.');
  }

  return data;
}

export async function syncSingleProductWithPulso(product) {
  const mapped = mapProductToPulsoPayload(product);
  if (!mapped.sku || !mapped.name) return null;

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
    throw new Error(data?.error || 'Error al actualizar el producto en Pulso.');
  }

  return data;
}

export async function pauseProductInPulso(sku) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) return null;

  const response = await fetch(`/api/pulso?sku=${encodeURIComponent(cleanSku)}`, {
    method: 'DELETE'
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Error al pausar el producto en Pulso.');
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
      .filter(item => item.sku && item.name);

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
