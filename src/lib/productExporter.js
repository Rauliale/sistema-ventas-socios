const CSV_COLUMNS = ['nombre', 'precio', 'stock', 'marca', 'descripcion', 'codigo'];
const UTF8_BOM = '\uFEFF';

/**
 * Escapes a single value for safe inclusion in a standard comma-separated CSV row.
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value).trim();
  const requiresQuotes =
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r');

  if (!requiresQuotes) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Maps an internal product entity to the external e-commerce CSV row schema:
 * nombre, precio, stock, marca, descripcion, codigo
 */
function mapProductToExternalRow(product) {
  const cleanPrice = Number(product.sale_price) || 0;
  const formattedPrice = Number.isInteger(cleanPrice) ? cleanPrice : cleanPrice.toFixed(2);

  return {
    nombre: product.name || '',
    precio: formattedPrice,
    stock: Number(product.stock) || 0,
    marca: product.brand || '',
    descripcion: product.description || '',
    codigo: product.barcode || product.sku || ''
  };
}

/**
 * Pure function that transforms a list of products into a CSV string
 * formatted for the external commerce platform.
 */
export function buildProductsCsvContent(products, { onlyInStock = true } = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No hay productos disponibles para exportar.');
  }

  const eligibleProducts = products.filter(product => {
    const isActive = product.active !== false;
    const hasStock = (Number(product.stock) || 0) > 0;
    return isActive && (!onlyInStock || hasStock);
  });

  if (eligibleProducts.length === 0) {
    throw new Error('No hay productos con stock disponible mayor a 0 para exportar.');
  }

  const headerLine = CSV_COLUMNS.join(',');
  const dataLines = eligibleProducts.map(product => {
    const mappedRow = mapProductToExternalRow(product);
    return CSV_COLUMNS.map(col => escapeCsvField(mappedRow[col])).join(',');
  });

  return {
    csvContent: `${UTF8_BOM}${[headerLine, ...dataLines].join('\r\n')}`,
    exportedCount: eligibleProducts.length
  };
}

/**
 * Browser file download wrapper to isolate DOM/Blob APIs from business logic.
 */
export function downloadCsvFile(csvContent, filename) {
  if (typeof window === 'undefined') {
    throw new Error('La descarga de archivos solo está disponible en el navegador.');
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const linkElement = document.createElement('a');

  linkElement.href = downloadUrl;
  linkElement.setAttribute('download', filename);
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Generates and downloads the CSV file with products currently in stock.
 */
export function exportProductsToCsv(products, options = { onlyInStock: true }) {
  const { csvContent, exportedCount } = buildProductsCsvContent(products, options);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `productos_stock_${dateStamp}.csv`;

  downloadCsvFile(csvContent, filename);

  return { exportedCount, filename };
}
