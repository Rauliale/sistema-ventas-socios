'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { useAuth } from '../../context/AuthContext';
import styles from './page.module.css';

export default function PointOfSale() {
  const { products, loading: productsLoading } = useProducts();
  const { processSale, loading: saleLoading } = useSales();
  const { user } = useAuth();

  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    if (!barcode) return;
    
    // Find product
    const prod = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (!prod) {
      setMessage({ type: 'error', text: 'Producto no encontrado' });
      return;
    }

    addToCart(prod);
    setBarcode('');
    setMessage({ type: '', text: '' });
  };

  const addToCart = (product) => {
    setCart(prev => {
      const exists = prev.find(item => item.product_id === product.id);
      if (exists) {
        return prev.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1, total_price: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: product.sale_price,
        quantity: 1,
        total_price: product.sale_price
      }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === id) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ, total_price: newQ * item.unit_price };
      }
      return item;
    }));
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(item => item.product_id !== id));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.total_price, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      // In a real app we get the actual seller ID. For now we use a dummy or null
      // The RPC expects a UUID for seller. We'll pass a random UUID or handle it in RPC.
      // Wait, let's fetch an admin or seller profile or just ignore seller for now
      // Actually we need a valid seller_id according to schema, so we should fetch one.
      
      await processSale(user?.id, null, paymentMethod, cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price
      })));
      
      setMessage({ type: 'success', text: 'Venta registrada con éxito' });
      setCart([]);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al registrar venta: ' + err.message });
    }
  };

  return (
    <div className="page-container">
      <h1>Punto de Venta</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div>
          <Card title="Escanear Producto">
            <form onSubmit={handleBarcodeScan} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input 
                  label="Código de Barras / SKU" 
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Escanea o escribe el código..."
                  disabled={productsLoading}
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={productsLoading || !barcode}>
                Agregar
              </Button>
            </form>
            {message.text && (
              <div style={{ marginTop: '1rem', color: message.type === 'error' ? 'var(--color-danger)' : 'var(--color-secondary)' }}>
                {message.text}
              </div>
            )}
          </Card>

          <Card title="Carrito" className="mt-4" style={{ marginTop: '2rem' }}>
            <div className={styles.cartContainer}>
              {cart.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>El carrito está vacío</p>
              ) : (
                cart.map(item => (
                  <div key={item.product_id} className={styles.cartItem}>
                    <div className={styles.itemInfo}>
                      <strong>{item.name}</strong>
                      <div>${item.unit_price.toFixed(2)} c/u</div>
                    </div>
                    <div className={styles.itemActions}>
                      <Button variant="secondary" onClick={() => updateQuantity(item.product_id, -1)}>-</Button>
                      <span style={{ minWidth: '2rem', textAlign: 'center' }}>{item.quantity}</span>
                      <Button variant="secondary" onClick={() => updateQuantity(item.product_id, 1)}>+</Button>
                      <Button variant="danger" onClick={() => removeItem(item.product_id)}>X</Button>
                    </div>
                    <div style={{ marginLeft: '1rem', fontWeight: 'bold' }}>
                      ${item.total_price.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card title="Resumen de Venta">
            <div className={styles.total}>
              Total: ${cartTotal.toFixed(2)}
            </div>

            <div style={{ marginTop: '2rem' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Método de Pago</label>
              <select 
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={styles.paymentSelect}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>

            <Button 
              variant="primary" 
              style={{ width: '100%', marginTop: '1rem', padding: '1rem', fontSize: '1.25rem' }}
              onClick={handleCheckout}
              disabled={cart.length === 0 || saleLoading}
              isLoading={saleLoading}
            >
              Confirmar Venta
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
