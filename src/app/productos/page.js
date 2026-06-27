'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProducts } from '../../hooks/useProducts';

export default function Productos() {
  const { products, loading, addProduct } = useProducts();
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    sku: '',
    sale_price: 0,
    cost_price: 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addProduct({
        name: formData.name,
        barcode: formData.barcode,
        sku: formData.sku,
        sale_price: parseFloat(formData.sale_price),
        cost_price: parseFloat(formData.cost_price)
      });
      setShowForm(false);
      setFormData({ name: '', barcode: '', sku: '', sale_price: 0, cost_price: 0 });
    } catch (err) {
      alert("Error al agregar producto: " + err.message);
    }
  };

  const columns = [
    { header: 'Código', accessor: 'barcode' },
    { header: 'Nombre', accessor: 'name' },
    { header: 'Costo ($)', accessor: 'cost_price' },
    { header: 'Venta ($)', accessor: 'sale_price' },
    { header: 'Stock Mínimo', accessor: 'min_stock' }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Gestión de Productos</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Nuevo Producto'}
        </Button>
      </div>

      {showForm && (
        <Card title="Agregar Producto" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <Input label="Nombre" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{flex: '1 1 200px'}} />
            <Input label="Código de Barras" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} style={{flex: '1 1 200px'}} />
            <Input label="SKU" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} style={{flex: '1 1 200px'}} />
            <Input label="Costo" type="number" step="0.01" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} required style={{flex: '1 1 100px'}} />
            <Input label="Venta" type="number" step="0.01" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: e.target.value})} required style={{flex: '1 1 100px'}} />
            
            <div style={{ width: '100%', marginTop: '1rem' }}>
              <Button type="submit">Guardar Producto</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Catálogo de Productos">
        {loading ? (
          <p>Cargando productos...</p>
        ) : (
          <Table columns={columns} data={products} />
        )}
      </Card>
    </div>
  );
}
