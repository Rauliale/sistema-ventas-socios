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
  const [suggestions, setSuggestions] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleBarcodeChange = (e) => {
    const val = e.target.value;
    setBarcode(val);
    
    if (val.length > 1) {
      const lowerVal = val.toLowerCase();
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(lowerVal) || 
        (p.barcode && p.barcode.toLowerCase().includes(lowerVal)) || 
        (p.sku && p.sku.toLowerCase().includes(lowerVal))
      );
      setSuggestions(matches.slice(0, 8)); // Mostrar top 8 coincidencias
    } else {
      setSuggestions([]);
    }
  };

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    if (!barcode) return;
    
    // Si solo hay un match o escriben el código exacto, agregarlo
    const prod = products.find(p => 
      p.barcode === barcode || 
      p.sku === barcode || 
      p.name.toLowerCase() === barcode.toLowerCase()
    );
    
    if (!prod) {
      setMessage({ type: 'error', text: 'Producto no encontrado o sea más específico' });
      return;
    }

    addToCart(prod);
    setBarcode('');
    setSuggestions([]);
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
    setBarcode('');
    setSuggestions([]);
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
            <form onSubmit={handleBarcodeScan} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', position: 'relative' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Input 
                  label="Código de Barras / SKU / Nombre" 
                  value={barcode}
                  onChange={handleBarcodeChange}
                  placeholder="Escanea o escribe el nombre/código..."
                  disabled={productsLoading}
                  autoFocus
                />
                
                {suggestions.length > 0 && (
                  <ul className={styles.suggestionsList}>
                    {suggestions.map(p => (
                      <li key={p.id} onClick={() => addToCart(p)}>
                        <span>{p.name}</span>
                        <strong>${Number(p.sale_price).toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="submit" disabled={productsLoading || !barcode}>
                Agregar
              </Button>
            </form>
            {message.text && (
              <div style={{ marginTop: '1rem', color: message.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }}>
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
