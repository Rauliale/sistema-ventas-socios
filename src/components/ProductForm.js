import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export function ProductForm({ initialData = {}, onSubmit, onCancel, isLoading = false, title = "Agregar Producto" }) {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    barcode: initialData.barcode || '',
    sku: initialData.sku || '',
    cost_price: initialData.cost_price || 0,
    profit_margin: initialData.profit_margin || 0,
    sale_price: initialData.sale_price || 0
  });

  // Calculate sale price when cost or profit margin changes
  const handleCostOrMarginChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    const cost = parseFloat(newFormData.cost_price) || 0;
    const margin = parseFloat(newFormData.profit_margin) || 0;
    const sale = cost + (cost * margin / 100);
    setFormData({ ...newFormData, sale_price: sale.toFixed(2) });
  };

  // Calculate profit margin when sale price changes
  const handleSalePriceChange = (value) => {
    const sale = parseFloat(value) || 0;
    const cost = parseFloat(formData.cost_price) || 0;
    let margin = 0;
    if (cost > 0) {
      margin = ((sale - cost) / cost) * 100;
    }
    setFormData({ ...formData, sale_price: value, profit_margin: margin.toFixed(2) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      cost_price: parseFloat(formData.cost_price),
      sale_price: parseFloat(formData.sale_price),
      profit_margin: parseFloat(formData.profit_margin)
    });
  };

  return (
    <Card title={title} style={{ marginBottom: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <Input 
          label="Nombre *" 
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})} 
          required 
          style={{flex: '1 1 100%'}} 
        />
        <Input 
          label="Código de Barras" 
          value={formData.barcode} 
          onChange={e => setFormData({...formData, barcode: e.target.value})} 
          style={{flex: '1 1 200px'}} 
        />
        <Input 
          label="SKU" 
          value={formData.sku} 
          onChange={e => setFormData({...formData, sku: e.target.value})} 
          style={{flex: '1 1 200px'}} 
        />
        <Input 
          label="Costo ($) *" 
          type="number" 
          step="0.01" 
          value={formData.cost_price} 
          onChange={e => handleCostOrMarginChange('cost_price', e.target.value)} 
          required 
          style={{flex: '1 1 120px'}} 
        />
        <Input 
          label="Ganancia (%)" 
          type="number" 
          step="0.01" 
          value={formData.profit_margin} 
          onChange={e => handleCostOrMarginChange('profit_margin', e.target.value)} 
          style={{flex: '1 1 120px'}} 
        />
        <Input 
          label="Venta ($) *" 
          type="number" 
          step="0.01" 
          value={formData.sale_price} 
          onChange={e => handleSalePriceChange(e.target.value)} 
          required 
          style={{flex: '1 1 120px'}} 
        />
        
        <div style={{ width: '100%', marginTop: '1rem', display: 'flex', gap: '1rem' }}>
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
