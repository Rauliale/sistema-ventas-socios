const PULSO_BASE_URL = 'https://dajoalas.com/ecomer/api/v1';
const DEFAULT_PULSO_KEY = 'pk_yFdcrdeLsaFM4pDPMJY4g6wCO-P0Gsnb5tBAA5FK';
const MAX_BATCH_SIZE = 500;

function getPulsoHeaders() {
  const apiKey = process.env.PULSO_API_KEY || DEFAULT_PULSO_KEY;
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'me';

    const allowedEndpoints = ['me', 'products', 'orders'];
    if (!allowedEndpoints.includes(endpoint)) {
      return Response.json({ error: 'Endpoint no permitido.' }, { status: 400 });
    }

    const upstreamUrl = new URL(`${PULSO_BASE_URL}/${endpoint}`);
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') {
        upstreamUrl.searchParams.set(key, value);
      }
    });

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: getPulsoHeaders(),
      cache: 'no-store'
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json(
        { error: data?.detail || data?.message || 'Error al consultar Pulso.' },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const products = Array.isArray(body?.products) ? body.products : [];
    const pauseMissing = Boolean(body?.pause_missing);

    if (products.length === 0) {
      return Response.json({ error: 'La lista de productos está vacía.' }, { status: 400 });
    }

    const summary = {
      created: 0,
      updated: 0,
      unchanged: 0,
      paused: 0,
      errors: []
    };

    // If fits in a single batch (<= 500), send directly with pause_missing
    if (products.length <= MAX_BATCH_SIZE) {
      const response = await fetch(`${PULSO_BASE_URL}/products`, {
        method: 'PUT',
        headers: getPulsoHeaders(),
        body: JSON.stringify({
          products,
          pause_missing: pauseMissing
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return Response.json(
          { error: data?.detail || data?.message || 'Error al publicar en Pulso.' },
          { status: response.status }
        );
      }

      return Response.json({
        created: data.created || 0,
        updated: data.updated || 0,
        unchanged: data.unchanged || 0,
        paused: data.paused || 0,
        errors: data.errors || []
      });
    }

    // Multi-batch handling for > 500 items
    for (let i = 0; i < products.length; i += MAX_BATCH_SIZE) {
      const batch = products.slice(i, i + MAX_BATCH_SIZE);
      const response = await fetch(`${PULSO_BASE_URL}/products`, {
        method: 'PUT',
        headers: getPulsoHeaders(),
        body: JSON.stringify({
          products: batch,
          pause_missing: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return Response.json(
          { error: data?.detail || data?.message || 'Error en lote al publicar en Pulso.' },
          { status: response.status }
        );
      }

      summary.created += data.created || 0;
      summary.updated += data.updated || 0;
      summary.unchanged += data.unchanged || 0;
      summary.paused += data.paused || 0;
      if (Array.isArray(data.errors)) {
        summary.errors.push(...data.errors);
      }
    }

    return Response.json(summary);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (!sku) {
      return Response.json({ error: 'Falta el parámetro sku.' }, { status: 400 });
    }

    const response = await fetch(`${PULSO_BASE_URL}/products/${encodeURIComponent(sku)}`, {
      method: 'DELETE',
      headers: getPulsoHeaders()
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { status: text };
    }

    if (!response.ok && response.status !== 404) {
      return Response.json(
        { error: data?.detail || data?.message || 'Error al pausar producto en Pulso.' },
        { status: response.status }
      );
    }

    return Response.json({ ok: true, ...data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
