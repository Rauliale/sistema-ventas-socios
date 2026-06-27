'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { useProducts } from '../../hooks/useProducts';
import { ProductForm } from '../../components/ProductForm';

export default function Productos() {
  const { products, loading, addProduct } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const handleAddProduct = async (formData) => {
    try {
      setSaving(true);
      await addProduct(formData);
      setShowForm(false);
    } catch (err) {
      alert("Error al agregar producto: " + err.message);
    } finally {
      setSaving(false);
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
        <ProductForm 
          onSubmit={handleAddProduct} 
          onCancel={() => setShowForm(false)} 
          isLoading={saving} 
        />
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
