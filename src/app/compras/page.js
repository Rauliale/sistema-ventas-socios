'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { usePurchases } from '../../hooks/usePurchases';
import { useProducts } from '../../hooks/useProducts';
import { db } from '../../lib/supabase';
import styles from './page.module.css';

export default function Compras() {
  const { processPurchase, fetchPurchases, loading } = usePurchases();
  const { products } = useProducts();

  const [partners, setPartners] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Cabecera de la compra
  const [header, setHeader] = useState({
    partner_id: '',
    invoice_number: '',
    observations: ''
  });

  // Ítems de la compra (lista dinámica)
  const [items, setItems] = useState([
    { product_id: '', quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    db.get('partners').then(data => setPartners(data || []));
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      const data = await fetchPurchases();
      setPurchases(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return; // Mínimo 1 ítem
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      // Auto-completar precio de costo cuando se selecciona un producto
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value);
        return { ...item, product_id: value, unit_price: prod ? prod.cost_price : 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!header.partner_id) {
      setMessage({ type: 'error', text: 'Debes seleccionar el socio que realiza la compra.' });
      return;
    }
    const invalidItems = items.filter(i => !i.product_id || i.quantity <= 0 || i.unit_price <= 0);
    if (invalidItems.length > 0) {
      setMessage({ type: 'error', text: 'Completa todos los ítems correctamente.' });
      return;
    }

    try {
      await processPurchase({
        partnerId: header.partner_id,
        supplierId: null,
        invoiceNumber: header.invoice_number,
        observations: header.observations,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity),
          unit_price: parseFloat(i.unit_price)
        }))
      });
      setMessage({ type: 'success', text: 'Compra registrada con éxito. Stock actualizado.' });
      setShowForm(false);
      setHeader({ partner_id: '', invoice_number: '', observations: '' });
      setItems([{ product_id: '', quantity: 1, unit_price: 0 }]);
      await loadPurchases();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al registrar compra: ' + err.message });
    }
  };

  const totalCompra = items.reduce((acc, i) => acc + (parseFloat(i.unit_price) * parseInt(i.quantity || 0)), 0);

  const columns = [
    { header: 'Fecha', accessor: 'date', render: row => new Date(row.date).toLocaleDateString('es-AR') },
    { header: 'Socio', accessor: 'partner', render: row => row.partners?.name },
    { header: 'N° Factura', accessor: 'invoice_number', render: row => row.invoice_number || '-' },
    { header: 'Total ($)', accessor: 'total_amount', render: row => `$${parseFloat(row.total_amount).toFixed(2)}` },
    { header: 'Observaciones', accessor: 'observations', render: row => row.observations || '-' }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Registro de Compras</h1>
        <Button onClick={() => { setShowForm(!showForm); setMessage({ type: '', text: '' }); }}>
          {showForm ? 'Cancelar' : '+ Nueva Compra'}
        </Button>
      </div>

      {message.text && (
        <div className={`${styles.alert} ${message.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <Card title="Nueva Compra / Ingreso de Mercadería" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSubmit}>
            {/* Cabecera */}
            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Socio Inversor *</label>
                <select
                  className={styles.select}
                  value={header.partner_id}
                  onChange={e => setHeader({ ...header, partner_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar socio...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="N° Factura / Remito"
                value={header.invoice_number}
                onChange={e => setHeader({ ...header, invoice_number: e.target.value })}
                placeholder="Ej: A-0001-00012345"
              />
              <Input
                label="Observaciones"
                value={header.observations}
                onChange={e => setHeader({ ...header, observations: e.target.value })}
                placeholder="Opcional..."
              />
            </div>

            {/* Ítems */}
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>Productos a ingresar</strong>
                <Button type="button" variant="secondary" onClick={addItem}>+ Agregar Producto</Button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className={styles.itemRow}>
                  <div style={{ flex: 3 }}>
                    <label className={styles.label}>Producto *</label>
                    <select
                      className={styles.select}
                      value={item.product_id}
                      onChange={e => updateItem(idx, 'product_id', e.target.value)}
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.barcode ? `(${p.barcode})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Cantidad *</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.input}
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Costo Unit. ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={styles.input}
                      value={item.unit_price}
                      onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Subtotal</label>
                    <div className={styles.subtotal}>
                      ${(parseFloat(item.unit_price || 0) * parseInt(item.quantity || 0)).toFixed(2)}
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button type="button" className={styles.removeBtn} onClick={() => removeItem(idx)}>×</button>
                  )}
                </div>
              ))}

              <div className={styles.totalRow}>
                <strong>Total a invertir: ${totalCompra.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <Button type="submit" isLoading={loading}>
                Confirmar Compra e Ingresar Stock
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Historial de Compras">
        {loading ? (
          <p>Cargando compras...</p>
        ) : purchases.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No hay compras registradas aún.
          </p>
        ) : (
          <Table columns={columns} data={purchases} />
        )}
      </Card>
    </div>
  );
}
