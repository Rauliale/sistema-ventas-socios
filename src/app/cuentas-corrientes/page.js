'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, ChevronDown, ChevronRight, CheckCircle, CreditCard, DollarSign } from 'lucide-react';
import styles from './cuentas.module.css';

export default function CuentasCorrientes() {
  const [loading, setLoading] = useState(true);
  const [customersData, setCustomersData] = useState([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  
  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    fetchCuentasCorrientes();
  }, []);

  const fetchCuentasCorrientes = async () => {
    try {
      setLoading(true);
      // Fetch all pending sales
      const { data: pendingSales, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          date,
          total_amount,
          paid_amount,
          customer_id,
          customers ( name, phone )
        `)
        .eq('status', 'pending');

      if (error) throw error;

      // Group by customer
      const grouped = {};
      let total = 0;

      pendingSales.forEach(sale => {
        const custId = sale.customer_id;
        const custName = sale.customers?.name || 'Cliente Desconocido';
        
        if (!grouped[custId]) {
          grouped[custId] = {
            customer_id: custId,
            customer_name: custName,
            customer_phone: sale.customers?.phone || '-',
            total_debt: 0,
            sales: []
          };
        }

        const remaining = parseFloat(sale.total_amount) - parseFloat(sale.paid_amount);
        grouped[custId].total_debt += remaining;
        grouped[custId].sales.push({
          ...sale,
          remaining_amount: remaining
        });

        total += remaining;
      });

      setCustomersData(Object.values(grouped).sort((a, b) => b.total_debt - a.total_debt));
      setGlobalTotal(total);
    } catch (err) {
      console.error('Error fetching cuentas corrientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (sale) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.remaining_amount.toString());
    setPaymentError('');
    setPaymentModalOpen(true);
  };

  const submitPayment = async () => {
    try {
      setPaymentLoading(true);
      setPaymentError('');

      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        setPaymentError('Ingrese un monto válido.');
        return;
      }
      if (amount > selectedSale.remaining_amount) {
        setPaymentError('El monto no puede superar la deuda de esta venta.');
        return;
      }

      const { error } = await supabase.rpc('rpc_register_partial_payment', {
        p_sale_id: selectedSale.id,
        p_amount: amount
      });

      if (error) throw error;

      setPaymentModalOpen(false);
      fetchCuentasCorrientes(); // Refresh data
    } catch (err) {
      console.error(err);
      setPaymentError(err.message || 'Error al registrar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>📘 Cuentas Corrientes</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-light)', borderRadius: '50%' }}>
              <DollarSign size={24} color="var(--color-danger)" />
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Deuda Global Pendiente</p>
              <h2 style={{ margin: 0, color: 'var(--color-danger)' }}>
                ${globalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Clientes con Deuda">
        {loading ? (
          <p>Cargando cuentas corrientes...</p>
        ) : customersData.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No hay clientes con deuda pendiente.
          </p>
        ) : (
          <div className={styles.customerList}>
            {customersData.map(customer => (
              <div key={customer.customer_id} className={styles.customerCard}>
                <div 
                  className={styles.customerHeader}
                  onClick={() => setExpandedCustomer(expandedCustomer === customer.customer_id ? null : customer.customer_id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {expandedCustomer === customer.customer_id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{customer.customer_name}</h3>
                      <small style={{ color: 'var(--color-text-secondary)' }}>Tel: {customer.customer_phone}</small>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      ${customer.total_debt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    <small style={{ color: 'var(--color-text-secondary)' }}>{customer.sales.length} ventas pendientes</small>
                  </div>
                </div>

                {expandedCustomer === customer.customer_id && (
                  <div className={styles.salesDetail}>
                    <Table 
                      columns={[
                        { header: 'Venta #', accessor: 'sale_number' },
                        { header: 'Fecha', render: row => new Date(row.date).toLocaleDateString('es-AR') },
                        { header: 'Total Venta', render: row => `$${parseFloat(row.total_amount).toLocaleString('es-AR')}` },
                        { header: 'Pagado', render: row => `$${parseFloat(row.paid_amount).toLocaleString('es-AR')}` },
                        { 
                          header: 'Pendiente', 
                          render: row => (
                            <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
                              ${row.remaining_amount.toLocaleString('es-AR')}
                            </span>
                          )
                        },
                        {
                          header: 'Acciones',
                          render: row => (
                            <Button variant="primary" size="small" onClick={() => handleOpenPayment(row)}>
                              <CreditCard size={14} style={{ marginRight: '4px' }} />
                              Cobrar
                            </Button>
                          )
                        }
                      ]}
                      data={customer.sales.sort((a, b) => new Date(a.date) - new Date(b.date))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Registrar Pago - Venta #{selectedSale?.sale_number}</h3>
            
            <div style={{ margin: '1.5rem 0', padding: '1rem', backgroundColor: 'var(--color-background)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Total de Venta:</span>
                <strong>${parseFloat(selectedSale?.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Abonado hasta ahora:</span>
                <strong>${parseFloat(selectedSale?.paid_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)', fontSize: '1.1rem' }}>
                <span>Saldo Pendiente:</span>
                <strong>${selectedSale?.remaining_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {paymentError && (
              <div style={{ color: 'var(--color-danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {paymentError}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <Input 
                label="Monto a Pagar ($)"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={submitPayment} isLoading={paymentLoading}>
                Confirmar Pago
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
