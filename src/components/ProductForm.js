import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import styles from './ProductForm.module.css';

const RECTIFICATION_REASONS = [
  'Pérdida / Extravío',
  'Producto roto o fallado',
  'Ajuste por recuento físico',
  'Uso interno / Garantía',
  'Otro motivo'
];

export function ProductForm({
  initialData = {},
  partners = [],
  onSubmit,
  onCancel,
  isLoading = false,
  title = "Agregar Producto"
}) {
  const isEditing = Boolean(initialData.id);
  const initialStock = Number(initialData.stock) || 0;

  const defaultPartnerId =
    initialData.product_lots?.find(lot => (Number(lot.quantity) || 0) > 0)?.partner_id ||
    initialData.product_lots?.[0]?.partner_id ||
    partners[0]?.id ||
    '';

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    barcode: initialData.barcode || '',
    sku: initialData.sku || '',
    cost_price: initialData.cost_price || 0,
    profit_margin: initialData.profit_margin || 0,
    sale_price: initialData.sale_price || 0,
    min_stock: initialData.min_stock || 0,
    real_stock: initialStock,
    rectification_reason: RECTIFICATION_REASONS[0],
    custom_reason: '',
    partner_id: defaultPartnerId
  });

  // Calculate sale price when cost or profit margin changes
  const handleCostOrMarginChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    const cost = parseFloat(newFormData.cost_price) || 0;
    const margin = parseFloat(newFormData.profit_margin) || 0;
    const sale = cost + (cost * margin / 100);
    setFormData({ ...newFormData, sale_price: sale.toFixed(2) });
  };

  // Calculate profit margin or cost price when sale price changes
  const handleSalePriceChange = (value) => {
    const sale = parseFloat(value) || 0;
    let cost = parseFloat(formData.cost_price) || 0;
    let margin = parseFloat(formData.profit_margin) || 0;
    const oldSale = parseFloat(formData.sale_price) || 0;

    // Detectar si estamos en medio de un cálculo automático por tipeo continuo
    const isAutoCalculated = cost === 0 || (margin === 100 && Math.abs(cost - oldSale / 2) < 0.02);

    if (isAutoCalculated) {
      margin = 100;
      cost = sale / 2;
      setFormData({ 
        ...formData, 
        sale_price: value, 
        profit_margin: margin.toFixed(2),
        cost_price: cost.toFixed(2)
      });
      return;
    }

    // Comportamiento normal: ajusta el margen de ganancia si ya existe un costo fijo
    if (cost > 0) {
      margin = ((sale - cost) / cost) * 100;
    }
    setFormData({ ...formData, sale_price: value, profit_margin: margin.toFixed(2) });
  };

  const parsedRealStock = parseInt(formData.real_stock, 10);
  const stockDelta = Number.isNaN(parsedRealStock) ? 0 : parsedRealStock - initialStock;
  const hasStockRectification = isEditing && stockDelta !== 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const {
      profit_margin,
      real_stock,
      rectification_reason,
      custom_reason,
      partner_id,
      ...dataToSubmit
    } = formData;
    
    // Auto-generate SKU and Barcode if left empty
    const finalSku = dataToSubmit.sku?.trim() || `SKU-${Date.now()}`;
    const finalBarcode = dataToSubmit.barcode?.trim() || Date.now().toString();
    
    const productPayload = {
      ...dataToSubmit,
      sku: finalSku,
      barcode: finalBarcode,
      cost_price: parseFloat(formData.cost_price),
      sale_price: parseFloat(formData.sale_price),
      min_stock: parseInt(formData.min_stock, 10) || 0
    };

    const finalReason =
      rectification_reason === 'Otro motivo' && custom_reason.trim()
        ? custom_reason.trim()
        : rectification_reason;

    const stockRectification = hasStockRectification
      ? {
          targetStock: parsedRealStock,
          partnerId: partner_id || defaultPartnerId,
          reason: finalReason,
          costPrice: parseFloat(formData.cost_price) || 0
        }
      : null;

    onSubmit(productPayload, stockRectification);
  };

  return (
    <Card title={title} className={styles.formCard}>
      <form onSubmit={handleSubmit}>
        <div className={styles.fieldsGrid}>
          <div className={styles.fullWidthField}>
            <Input 
              label="Nombre *" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
            />
          </div>
          <div>
            <Input 
              label="Código de Barras" 
              value={formData.barcode} 
              onChange={e => setFormData({...formData, barcode: e.target.value})} 
            />
          </div>
          <div>
            <Input 
              label="SKU (Opcional - Auto)" 
              value={formData.sku} 
              onChange={e => setFormData({...formData, sku: e.target.value})} 
            />
          </div>
          <div>
            <Input 
              label="Costo ($) *" 
              type="number" 
              step="0.01" 
              value={formData.cost_price} 
              onChange={e => handleCostOrMarginChange('cost_price', e.target.value)} 
              required 
            />
          </div>
          <div>
            <Input 
              label="Ganancia (%)" 
              type="number" 
              step="0.01" 
              value={formData.profit_margin} 
              onChange={e => handleCostOrMarginChange('profit_margin', e.target.value)} 
            />
          </div>
          <div>
            <Input 
              label="Venta ($) *" 
              type="number" 
              step="0.01" 
              value={formData.sale_price} 
              onChange={e => handleSalePriceChange(e.target.value)} 
              required 
            />
          </div>
          <div>
            <Input 
              label="Stock Mínimo" 
              type="number" 
              step="1" 
              value={formData.min_stock} 
              onChange={e => setFormData({...formData, min_stock: e.target.value})} 
            />
          </div>
          {isEditing && (
            <div>
              <Input
                label={`Stock Real (Sistema: ${initialStock}${initialData.stockBreakdown || ''})`}
                type="number"
                min="0"
                step="1"
                value={formData.real_stock}
                onChange={e => setFormData({ ...formData, real_stock: e.target.value })}
                required
              />
            </div>
          )}
        </div>

        {hasStockRectification && (
          <div className={styles.rectificationPanel}>
            <div className={styles.rectificationHeader}>
              <span>Rectificación de Stock Real</span>
              <span className={stockDelta < 0 ? styles.deltaBadgeNegative : styles.deltaBadgePositive}>
                {initialStock} → {parsedRealStock} ({stockDelta > 0 ? `+${stockDelta}` : stockDelta} u.)
              </span>
            </div>

            <div className={styles.rectificationGrid}>
              <div className={styles.selectWrapper}>
                <label className={styles.selectLabel}>Motivo del ajuste</label>
                <select
                  className={styles.selectInput}
                  value={formData.rectification_reason}
                  onChange={e => setFormData({ ...formData, rectification_reason: e.target.value })}
                >
                  {RECTIFICATION_REASONS.map(reason => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {partners.length > 0 && (
                <div className={styles.selectWrapper}>
                  <label className={styles.selectLabel}>Socio afectado</label>
                  <select
                    className={styles.selectInput}
                    value={formData.partner_id || defaultPartnerId}
                    onChange={e => setFormData({ ...formData, partner_id: e.target.value })}
                  >
                    {partners.map(partner => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.rectification_reason === 'Otro motivo' && (
                <div>
                  <Input
                    label="Detalle del motivo"
                    placeholder="Ej: Devolución a proveedor, merma..."
                    value={formData.custom_reason}
                    onChange={e => setFormData({ ...formData, custom_reason: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className={styles.actionsRow}>
          <Button type="submit" isLoading={isLoading}>Guardar Producto</Button>
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
