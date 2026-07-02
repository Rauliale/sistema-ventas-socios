'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { db } from '../../lib/supabase';
import styles from './finanzas.module.css';
import { Wallet, Landmark, ArrowDownRight, ArrowUpRight, Plus, X, AlertTriangle } from 'lucide-react';

export default function Finanzas() {
  const [movements, setMovements] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Resumen del Fondo Común
  const [cashSummary, setCashSummary] = useState({
    total: 0,
    sales: 0,
    expenses: 0,
    withdrawals: 0,
    investments: 0
  });
  
  const [transferSummary, setTransferSummary] = useState({
    total: 0,
    sales: 0,
    expenses: 0,
    withdrawals: 0,
    investments: 0
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'withdrawal', // withdrawal | investment
    partner_id: '',
    amount: '',
    payment_method: 'Efectivo', // Efectivo | Transferencia
    description: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  const loadFinances = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      // 1. Obtener socios
      const partnersList = await db.get('partners');
      setPartners(partnersList || []);
      const pMap = {};
      partnersList.forEach(p => pMap[p.id] = p.name);

      const { supabase } = await import('../../lib/supabase');

      // 2. Obtener ventas
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('payment_method, total_amount');
      if (salesErr) throw salesErr;

      // 3. Obtener gastos (solo pagados)
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('amount, paid_from_register, status')
        .eq('status', 'paid');
      if (expErr) throw expErr;

      // 4. Obtener todos los movimientos financieros
      const { data: finMovements, error: finErr } = await supabase
        .from('financial_movements')
        .select('*')
        .order('date', { ascending: false });
      if (finErr) throw finErr;

      // --- CÁLCULO DEL FONDO COMÚN ---
      
      // Ventas
      let salesCash = 0;
      let salesTransfer = 0;
      (sales || []).forEach(s => {
        const amt = parseFloat(s.total_amount) || 0;
        if (s.payment_method === 'Efectivo') {
          salesCash += amt;
        } else {
          salesTransfer += amt;
        }
      });

      // Gastos
      let expensesCash = 0;
      let expensesTransfer = 0;
      (expenses || []).forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        if (e.paid_from_register) {
          expensesCash += amt;
        } else {
          expensesTransfer += amt;
        }
      });

      // Retiros e inversiones
      let withdrawalsCash = 0;
      let withdrawalsTransfer = 0;
      let investmentsCash = 0;
      let investmentsTransfer = 0;

      (finMovements || []).forEach(m => {
        const amt = parseFloat(m.amount) || 0;
        if (m.type === 'withdrawal') {
          if (m.payment_method === 'Efectivo') {
            withdrawalsCash += amt; // Los retiros son negativos
          } else {
            withdrawalsTransfer += amt;
          }
        } else if (m.type === 'investment' && !m.related_id) {
          // Aportes de capital directos (sin related_id de compras)
          if (m.payment_method === 'Efectivo') {
            investmentsCash += amt;
          } else {
            investmentsTransfer += amt;
          }
        }
      });

      // Totales
      const cashTotal = salesCash - expensesCash + withdrawalsCash + investmentsCash;
      const transferTotal = salesTransfer - expensesTransfer + withdrawalsTransfer + investmentsTransfer;

      setCashSummary({
        total: cashTotal,
        sales: salesCash,
        expenses: expensesCash,
        withdrawals: Math.abs(withdrawalsCash),
        investments: investmentsCash
      });

      setTransferSummary({
        total: transferTotal,
        sales: salesTransfer,
        expenses: expensesTransfer,
        withdrawals: Math.abs(withdrawalsTransfer),
        investments: investmentsTransfer
      });

      const typeTranslations = {
        'investment': 'Inversión',
        'expense': 'Gasto',
        'profit': 'Ganancia',
        'withdrawal': 'Retiro'
      };

      const tableData = (finMovements || []).map(m => ({
        ...m,
        partnerName: pMap[m.partner_id] || 'Desconocido',
        typeTranslated: typeTranslations[m.type] || m.type,
        dateFmt: new Date(m.date).toLocaleString('es-AR'),
        amountFmt: (m.amount >= 0 ? '+' : '') + `$${parseFloat(m.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }));

      setMovements(tableData);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al cargar la información financiera: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, []);

  const handleOpenModal = () => {
    setFormData({
      type: 'withdrawal',
      partner_id: partners[0]?.id || '',
      amount: '',
      payment_method: 'Efectivo',
      description: ''
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.partner_id) {
      setErrorMsg('Debes seleccionar un socio.');
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Ingresa un importe válido mayor a cero.');
      return;
    }

    // Validación de fondos suficientes para retiros
    if (formData.type === 'withdrawal') {
      const fundLimit = formData.payment_method === 'Efectivo' ? cashSummary.total : transferSummary.total;
      if (amt > fundLimit) {
        setErrorMsg(`Fondos insuficientes en el Fondo Común (${formData.payment_method}). Disponible: $${fundLimit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const signedAmount = formData.type === 'withdrawal' ? -amt : amt;

      await db.insert('financial_movements', {
        partner_id: formData.partner_id,
        type: formData.type,
        amount: signedAmount,
        payment_method: formData.payment_method,
        description: formData.description.trim() || null,
        date: new Date().toISOString()
      });

      await loadFinances();
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar el movimiento: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { header: 'Fecha', accessor: 'dateFmt' },
    { header: 'Socio', accessor: 'partnerName' },
    { 
      header: 'Operación', 
      render: (row) => {
        let badgeClass = styles.badge;
        if (row.type === 'profit') badgeClass += ` ${styles.badgeProfit}`;
        else if (row.type === 'expense') badgeClass += ` ${styles.badgeExpense}`;
        else if (row.type === 'investment') badgeClass += ` ${styles.badgeInvestment}`;
        else if (row.type === 'withdrawal') badgeClass += ` ${styles.badgeWithdrawal}`;

        return <span className={badgeClass}>{row.typeTranslated}</span>;
      }
    },
    { 
      header: 'Forma de Pago', 
      render: (row) => row.payment_method || 'Efectivo' 
    },
    { 
      header: 'Importe', 
      render: (row) => {
        const isNegative = parseFloat(row.amount) < 0;
        return (
          <span style={{ color: isNegative ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
            {row.amountFmt}
          </span>
        );
      }
    },
    { 
      header: 'Observaciones', 
      render: (row) => row.description || '-' 
    }
  ];

  // Chequear advertencia de fondos bajos para el formulario en tiempo real
  const currentFundBalance = formData.payment_method === 'Efectivo' ? cashSummary.total : transferSummary.total;
  const showFundWarning = formData.type === 'withdrawal' && parseFloat(formData.amount) > currentFundBalance;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Gestión de Finanzas</h1>
        <Button onClick={handleOpenModal} variant="primary">
          <Plus size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Registrar Retiro / Aporte
        </Button>
      </div>

      {/* Grid del Fondo Común */}
      <div className={styles.grid}>
        {/* Tarjeta de Efectivo */}
        <div className={`${styles.fundCard} ${styles.cashCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Fondo Común (Efectivo)</span>
            <Wallet className={styles.cardIcon} style={{ color: '#10b981' }} size={24} />
          </div>
          <div className={styles.cardValue}>
            ${cashSummary.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardBreakdown}>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Ventas</span>
              <span className={`${styles.breakdownValue} ${styles.positive}`}>
                +${cashSummary.sales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Gastos</span>
              <span className={`${styles.breakdownValue} ${styles.negative}`}>
                -${cashSummary.expenses.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Retiros</span>
              <span className={`${styles.breakdownValue} ${styles.negative}`}>
                -${cashSummary.withdrawals.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Aportes</span>
              <span className={`${styles.breakdownValue} ${styles.positive}`}>
                +${cashSummary.investments.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Transferencias */}
        <div className={`${styles.fundCard} ${styles.transferCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Fondo Común (Transferencia)</span>
            <Landmark className={styles.cardIcon} style={{ color: '#3b82f6' }} size={24} />
          </div>
          <div className={styles.cardValue}>
            ${transferSummary.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={styles.cardBreakdown}>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Ventas</span>
              <span className={`${styles.breakdownValue} ${styles.positive}`}>
                +${transferSummary.sales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Gastos</span>
              <span className={`${styles.breakdownValue} ${styles.negative}`}>
                -${transferSummary.expenses.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Retiros</span>
              <span className={`${styles.breakdownValue} ${styles.negative}`}>
                -${transferSummary.withdrawals.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.breakdownLabel}>Aportes</span>
              <span className={`${styles.breakdownValue} ${styles.positive}`}>
                +${transferSummary.investments.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Movimientos */}
      <Card title="Historial Completo de Movimientos Financieros">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando finanzas...</p>
        ) : (
          <Table columns={columns} data={movements} />
        )}
      </Card>

      {/* Modal para Registrar Movimiento */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Registrar Movimiento Financiero</h2>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {errorMsg && (
                <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1.25rem', fontWeight: '500' }}>
                  {errorMsg}
                </div>
              )}

              {showFundWarning && (
                <div className={styles.warningAlert}>
                  <AlertTriangle size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  El importe supera los fondos disponibles en el fondo de {formData.payment_method} (${currentFundBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}).
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo de Operación</label>
                <select 
                  name="type" 
                  value={formData.type} 
                  onChange={handleFormChange}
                  className={styles.selectInput}
                >
                  <option value="withdrawal">Retiro de Socio (Egreso)</option>
                  <option value="investment">Aporte de Capital (Ingreso)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Socio</label>
                <select 
                  name="partner_id" 
                  value={formData.partner_id} 
                  onChange={handleFormChange}
                  className={styles.selectInput}
                  required
                >
                  <option value="" disabled>Selecciona un socio</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <Input 
                  label="Importe ($)" 
                  type="number" 
                  name="amount" 
                  step="0.01" 
                  value={formData.amount} 
                  onChange={handleFormChange} 
                  placeholder="0.00"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Método de Pago</label>
                <select 
                  name="payment_method" 
                  value={formData.payment_method} 
                  onChange={handleFormChange}
                  className={styles.selectInput}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Observaciones / Destino</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleFormChange}
                  placeholder="Ej: Retiro para compra de mercadería en Once..."
                  className={styles.textareaInput}
                />
              </div>

              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={handleCloseModal} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  Confirmar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
