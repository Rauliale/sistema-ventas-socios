'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { useAuth } from '../../context/AuthContext';
import { useCashRegister } from '../../hooks/useCashRegister';
import { useExpenses } from '../../hooks/useExpenses';
import styles from './page.module.css';

export default function PointOfSale() {
  const { products, loading: productsLoading } = useProducts();
  const { processSale, loading: saleLoading } = useSales();
  const { user } = useAuth();
  
  const { activeRegister, loading: registerLoading, openRegister, closeRegister, getClosurePreview } = useCashRegister();
  const { categories, addExpense } = useExpenses();

  const [barcode, setBarcode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [initialCash, setInitialCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closurePreview, setClosurePreview] = useState(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', category_id: '', amount: '', shared_type: '50/50' });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

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

  if (registerLoading) return <div className="page-container">Cargando estado de caja...</div>;

  if (!activeRegister) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Card title="Apertura de Caja" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
            Debes abrir la caja para poder registrar ventas en este turno.
          </p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            await openRegister(initialCash);
          }}>
            <Input 
              label="Efectivo Inicial (Cambio)" 
              type="number" 
              step="0.01" 
              value={initialCash} 
              onChange={e => setInitialCash(e.target.value)} 
              required 
              autoFocus
            />
            <Button type="submit" style={{ width: '100%', marginTop: '1.5rem' }}>
              Abrir Caja
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Punto de Venta</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={() => setShowExpenseModal(true)}>
            Registrar Gasto
          </Button>
          <Button variant="danger" onClick={async () => {
            const preview = await getClosurePreview();
            setClosurePreview(preview);
            setShowCloseModal(true);
          }}>
            Cerrar Caja
          </Button>
        </div>
      </div>

      {showExpenseModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <Card title="Gasto de Caja Diaria" style={{ minWidth: '400px' }}>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setExpenseSubmitting(true);
                await addExpense({
                  description: expenseForm.description,
                  category_id: expenseForm.category_id,
                  amount: parseFloat(expenseForm.amount),
                  shared_type: expenseForm.shared_type,
                  paid_from_register: true
                });
                setShowExpenseModal(false);
                setExpenseForm({ description: '', category_id: expenseForm.category_id, amount: '', shared_type: '50/50' });
                setMessage({ type: 'success', text: 'Gasto registrado y descontado de la caja' });
              } catch (err) {
                setMessage({ type: 'error', text: 'Error al registrar gasto: ' + err.message });
              } finally {
                setExpenseSubmitting(false);
              }
            }}>
              <Input 
                label="Descripción del Gasto" 
                value={expenseForm.description}
                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                required
                autoFocus
              />
              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Categoría</label>
                <select 
                  className={styles.paymentSelect}
                  value={expenseForm.category_id}
                  onChange={e => setExpenseForm({...expenseForm, category_id: e.target.value})}
                  required
                >
                  <option value="">Seleccione categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <Input 
                label="Monto Retirado de Caja ($)" 
                type="number" 
                step="0.01" 
                value={expenseForm.amount}
                onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                required
              />
              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Distribución (Quién lo paga)</label>
                <select 
                  className={styles.paymentSelect}
                  value={expenseForm.shared_type}
                  onChange={e => setExpenseForm({...expenseForm, shared_type: e.target.value})}
                >
                  <option value="50/50">50/50 (Raúl y Nahuel)</option>
                  <option value="100_raul">100% Raúl</option>
                  <option value="100_nahuel">100% Nahuel</option>
                  <option value="100_negro">100% Negro Añais</option>
                  <option value="33_all">Partes Iguales (Raúl, Nahuel, Negro)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={expenseSubmitting}>Registrar</Button>
                <Button type="button" variant="secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showCloseModal && closurePreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <Card title="Arqueo y Cierre de Caja" style={{ minWidth: '400px' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Fondo Inicial:</span>
                <strong>${closurePreview.initialCash.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Ventas en Efectivo:</span>
                <strong style={{ color: 'var(--color-success)' }}>+ ${closurePreview.totalCashSales.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                <span>Efectivo Esperado en Cajón:</span>
                <strong style={{ fontSize: '1.2rem' }}>${closurePreview.expectedCash.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span>Total Transferencias/Tarjetas:</span>
                <strong style={{ color: 'var(--color-primary)' }}>${closurePreview.totalTransferSales.toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              await closeRegister(activeRegister.id, actualCash);
              setShowCloseModal(false);
              setActualCash('');
            }}>
              <Input 
                label="Efectivo Real Contado" 
                type="number" 
                step="0.01" 
                value={actualCash} 
                onChange={e => setActualCash(e.target.value)} 
                required 
                autoFocus
              />
              {actualCash !== '' && (
                <div style={{ marginTop: '1rem', textAlign: 'center', fontWeight: 'bold', 
                  color: (parseFloat(actualCash) - closurePreview.expectedCash) === 0 ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  Diferencia: ${(parseFloat(actualCash) - closurePreview.expectedCash).toFixed(2)}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Button type="submit" variant="danger" style={{ flex: 1 }}>Confirmar Cierre</Button>
                <Button type="button" variant="secondary" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

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
