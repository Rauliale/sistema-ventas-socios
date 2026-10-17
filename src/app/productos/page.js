'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { useProducts } from '../../hooks/useProducts';
import { usePartners } from '../../hooks/usePurchases';
import { ProductForm } from '../../components/ProductForm';
import { exportProductsToCsv } from '../../lib/productExporter';
import styles from './productos.module.css';

export default function Productos() {
  const { products, loading, addProduct, updateProduct, rectifyProductStock, deleteProduct } = useProducts();
  const { partners } = usePartners();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const inStockCount = products.filter(
    product => product.active !== false && (Number(product.stock) || 0) > 0
  ).length;
  
  const handleEditClick = (product) => {
    setEditingProduct(product);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (product) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar definitivamente el producto "${product.name}"?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(product.id);
      await deleteProduct(product.id);
      if (editingProduct?.id === product.id) {
        setShowForm(false);
        setEditingProduct(null);
      }
    } catch (err) {
      alert('Error al eliminar producto: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    try {
      exportProductsToCsv(products, { onlyInStock: true });
    } catch (err) {
      alert('Error al exportar productos: ' + err.message);
    }
  };

  const handleSaveProduct = async (formData, stockRectification) => {
    try {
      setSaving(true);
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
        if (stockRectification) {
          await rectifyProductStock(editingProduct.id, stockRectification);
        }
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
    { header: 'Stock Actual', accessor: 'stock', render: row => `${row.stock}${row.stockBreakdown || ''}` },
    { header: 'Stock Mínimo', accessor: 'min_stock' },
    {
      header: 'Acción',
      render: row => (
        <div className={styles.rowActions}>
          <Button onClick={() => handleEditClick(row)} disabled={deletingId === row.id}>
            Editar
          </Button>
          <Button
            variant="danger"
            onClick={() => handleDeleteClick(row)}
            isLoading={deletingId === row.id}
            disabled={deletingId !== null && deletingId !== row.id}
          >
            Eliminar
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className={styles.headerBar}>
        <h1 className={styles.headerTitle}>Gestión de Productos</h1>
        <div className={styles.actionGroup}>
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={loading || inStockCount === 0}
          >
            <Download size={16} className={styles.buttonIcon} />
            Exportar CSV ({inStockCount} en stock)
          </Button>
          <Button onClick={() => { setEditingProduct(null); setShowForm(!showForm); }}>
            {showForm && !editingProduct ? 'Cancelar' : 'Nuevo Producto'}
          </Button>
        </div>
      </div>

      {showForm && (
        <ProductForm 
          key={editingProduct ? `${editingProduct.id}-${editingProduct.stock}` : 'new'}
          title={editingProduct ? "Editar Producto" : "Agregar Producto"}
          initialData={editingProduct || {}}
          partners={partners}
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
