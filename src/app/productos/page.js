'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { useProducts } from '../../hooks/useProducts';
import { ProductForm } from '../../components/ProductForm';

export default function Productos() {
  const { products, loading, addProduct, updateProduct } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const handleEditClick = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleSaveProduct = async (formData) => {
    try {
      setSaving(true);
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await addProduct(formData);
      }
      setShowForm(false);
      setEditingProduct(null);
    } catch (err) {
      alert("Error al guardar producto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const columns = [
    { header: 'Código', accessor: 'barcode' },
    { header: 'Nombre', accessor: 'name' },
    { header: 'Costo ($)', accessor: 'cost_price' },
    { header: 'Venta ($)', accessor: 'sale_price' },
    { header: 'Stock Actual', accessor: 'stock' },
    { header: 'Stock Mínimo', accessor: 'min_stock' },
    { header: 'Acción', render: row => <Button onClick={() => handleEditClick(row)}>Editar</Button> }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Gestión de Productos</h1>
        <Button onClick={() => { setEditingProduct(null); setShowForm(!showForm); }}>
          {showForm && !editingProduct ? 'Cancelar' : 'Nuevo Producto'}
        </Button>
      </div>

      {showForm && (
        <ProductForm 
          key={editingProduct ? editingProduct.id : 'new'}
          title={editingProduct ? "Editar Producto" : "Agregar Producto"}
          initialData={editingProduct || {}}
          onSubmit={handleSaveProduct} 
          onCancel={handleCancel} 
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
