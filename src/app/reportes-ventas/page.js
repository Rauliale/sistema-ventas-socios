'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { useSalesReports } from '../../hooks/useSalesReports';
import { useSales } from '../../hooks/useSales';
import { Edit2, XCircle } from 'lucide-react';
import styles from './Reportes.module.css';

export default function ReportesVentas() {
  const {
    salesDetails,
    sales,
    loading,
    error,
    dateFilter,
    setDateFilter,
    customDate,
    setCustomDate,
    partnerFilter,
    setPartnerFilter,
    refresh
  } = useSalesReports();

  const { updateSalePaymentMethod, cancelSale } = useSales();

  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'details'
  
  // State for editing
  const [editingSale, setEditingSale] = useState(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [editError, setEditError] = useState(null);

  // State for cancelling
  const [cancellingSale, setCancellingSale] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('Error en la carga');
  const [customReasonText, setCustomReasonText] = useState('');
  const [cancellingStatus, setCancellingStatus] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Calcular totales
  const { totalRevenue, totalProfit, totalItems } = useMemo(() => {
    return salesDetails.reduce((acc, row) => ({
      totalRevenue: acc.totalRevenue + Number(row.total_revenue),
      totalProfit: acc.totalProfit + Number(row.net_profit),
      totalItems: acc.totalItems + Number(row.sold_quantity)
    }), { totalRevenue: 0, totalProfit: 0, totalItems: 0 });
  }, [salesDetails]);

  // Filter sales based on partnerFilter
  const filteredSales = useMemo(() => {
    if (partnerFilter === 'all') return sales;
    // Get all sale IDs that have items for this partner
    const partnerSaleIds = new Set(
      salesDetails
        .filter(item => item.partner_name === partnerFilter)
        .map(item => item.sale_id)
    );
    return sales.filter(s => partnerSaleIds.has(s.id));
  }, [sales, salesDetails, partnerFilter]);

  const handleUpdatePaymentMethod = async (e) => {
    e.preventDefault();
    if (!editingSale || !newPaymentMethod) return;
    try {
      setUpdatingPayment(true);
      setEditError(null);
      await updateSalePaymentMethod(editingSale.id, newPaymentMethod);
      setEditingSale(null);
      refresh();
    } catch (err) {
      setEditError('Error al actualizar método de pago: ' + err.message);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleCancelSale = async (e) => {
    e.preventDefault();
    if (!cancellingSale) return;
    
    const finalReason = cancellationReason === 'Otro' 
      ? (customReasonText.trim() || 'Otro motivo')
      : cancellationReason;

    try {
      setCancellingStatus(true);
      setCancelError(null);
      await cancelSale(cancellingSale.id, finalReason);
      setCancellingSale(null);
      setCustomReasonText('');
      refresh();
    } catch (err) {
      setCancelError('Error al cancelar la venta: ' + err.message);
    } finally {
      setCancellingStatus(false);
    }
  };

  // Configuración de tabla de artículos
  const columns = [
    { header: 'Fecha', accessor: 'dateFmt', render: row => new Date(row.sale_date).toLocaleString() },
    { header: 'Venta #', accessor: 'sale_number' },
    { header: 'Dueño del Stock', accessor: 'partner_name' },
    { header: 'Producto', accessor: 'product_name' },
    { header: 'Cant.', accessor: 'sold_quantity' },
    { header: 'Ingreso', accessor: 'revFmt', render: row => `$${Number(row.total_revenue).toFixed(2)}` },
    { header: 'Ganancia Neta', accessor: 'profFmt', render: row => `$${Number(row.net_profit).toFixed(2)}` }
  ];

  // Configuración de tabla de ventas
  const salesColumns = [
    { header: 'Nº Venta', accessor: 'sale_number', render: row => `#${row.sale_number}` },
    { header: 'Fecha', accessor: 'date', render: row => new Date(row.date).toLocaleString('es-AR') },
    { header: 'Vendedor', accessor: 'seller_name' },
    {
      header: 'Forma de Pago',
      accessor: 'payment_method',
      render: row => (
        <span className={`${styles.paymentBadge} ${
          row.payment_method === 'Efectivo' ? styles.badgeCash : styles.badgeDigital
        }`}>
          {row.payment_method}
        </span>
      )
    },
    { header: 'Total', accessor: 'total_amount', render: row => `$${Number(row.total_amount).toFixed(2)}` },
    {
      header: 'Estado',
      accessor: 'status',
      render: row => {
        const isCancelled = row.status === 'cancelled';
        return (
          <span 
            className={`${styles.paymentBadge} ${isCancelled ? styles.badgeCancelled : styles.badgeCompleted}`}
            title={isCancelled && row.cancellation_reason ? `Motivo: ${row.cancellation_reason}` : ''}
          >
            {isCancelled ? 'Cancelada' : 'Completada'}
          </span>
        );
      }
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: row => {
        const isCancelled = row.status === 'cancelled';
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setEditingSale(row);
                setNewPaymentMethod(row.payment_method);
                setEditError(null);
              }}
              disabled={isCancelled}
              style={{
                background: 'transparent',
                border: 'none',
                color: isCancelled ? 'var(--color-border)' : 'var(--color-text-secondary)',
                cursor: isCancelled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
              }}
              onMouseEnter={e => { if(!isCancelled) e.currentTarget.style.color = 'var(--color-primary)' }}
              onMouseLeave={e => { if(!isCancelled) e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              title={isCancelled ? "Venta cancelada" : "Editar Método de Pago"}
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => {
                setCancellingSale(row);
                setCancelError(null);
              }}
              disabled={isCancelled}
              style={{
                background: 'transparent',
                border: 'none',
                color: isCancelled ? 'var(--color-border)' : 'var(--color-danger)',
                cursor: isCancelled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
              }}
              onMouseEnter={e => { if(!isCancelled) e.currentTarget.style.color = 'var(--color-danger-hover, #dc2626)' }}
              onMouseLeave={e => { if(!isCancelled) e.currentTarget.style.color = 'var(--color-danger)' }}
              title={isCancelled ? "Venta cancelada" : "Cancelar Venta"}
            >
              <XCircle size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      <h1>Reportes de Ventas</h1>

      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label>Periodo:</label>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="today">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="custom">Día Específico</option>
            <option value="all">Histórico Completo</option>
          </select>
        </div>

        {dateFilter === 'custom' && (
          <div className={styles.filterGroup}>
            <label>Seleccionar Fecha:</label>
            <input 
              type="date" 
              className={styles.dateInput}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              min="2026-07-01"
            />
          </div>
        )}

        <div className={styles.filterGroup}>
          <label>Filtrar por Socio:</label>
          <select value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)}>
            <option value="all">Todos los Socios</option>
            <option value="Raúl">Raúl</option>
            <option value="Nahuel">Nahuel</option>
          </select>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <Card title="Ingreso Bruto" className={styles.summaryCard}>
          <h2 style={{ color: 'var(--color-primary)', fontSize: '2rem' }}>
            ${totalRevenue.toFixed(2)}
          </h2>
        </Card>
        
        <Card title="Ganancia Neta" className={styles.summaryCard}>
          <h2 style={{ color: 'var(--color-success)', fontSize: '2rem' }}>
            ${totalProfit.toFixed(2)}
          </h2>
        </Card>

        <Card title="Productos Vendidos" className={styles.summaryCard}>
          <h2 style={{ color: 'var(--color-secondary)', fontSize: '2rem' }}>
            {totalItems} un.
          </h2>
        </Card>
      </div>

      {/* Tabs Layout */}
      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'sales' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Resumen de Ventas
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'details' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Detalle por Artículo
        </button>
      </div>

      {activeTab === 'sales' ? (
        <Card title="Listado de Ventas">
          {error && <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>}
          
          {loading ? (
            <p>Cargando ventas...</p>
          ) : (
            <Table columns={salesColumns} data={filteredSales} />
          )}
        </Card>
      ) : (
        <Card title="Detalle de Artículos Vendidos">
          {error && <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>}
          
          {loading ? (
            <p>Cargando reporte...</p>
          ) : (
            <Table columns={columns} data={salesDetails} />
          )}
        </Card>
      )}

      {/* Modal de edición */}
      {editingSale && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <Card title={`Editar Método de Pago - Venta #${editingSale.sale_number}`} style={{ minWidth: '400px' }}>
            <form onSubmit={handleUpdatePaymentMethod}>
              {editError && <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{editError}</p>}
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Fecha:</span>
                  <strong>{new Date(editingSale.date).toLocaleString('es-AR')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Total:</span>
                  <strong>${parseFloat(editingSale.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Método Actual:</span>
                  <span className={`${styles.paymentBadge} ${
                    editingSale.payment_method === 'Efectivo' ? styles.badgeCash : styles.badgeDigital
                  }`}>
                    {editingSale.payment_method}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Nuevo Método de Pago</label>
                <select 
                  className={styles.paymentSelect}
                  value={newPaymentMethod}
                  onChange={e => setNewPaymentMethod(e.target.value)}
                  required
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </div>

              {/* Advertencia fiscal contextual */}
              {editingSale.payment_method === 'Efectivo' && newPaymentMethod !== 'Efectivo' && newPaymentMethod !== '' && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b',
                  fontSize: '0.875rem', color: '#b45309'
                }}>
                  ⚠️ Al cambiar a un medio digital, se calculará y descontará automáticamente una retención del 4% (${(parseFloat(editingSale.total_amount) * 0.04).toFixed(2)}) de impuestos provinciales.
                </div>
              )}

              {editingSale.payment_method !== 'Efectivo' && newPaymentMethod === 'Efectivo' && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)', borderLeft: '3px solid #3b82f6',
                  fontSize: '0.875rem', color: '#1d4ed8'
                }}>
                  ℹ️ Al cambiar a Efectivo, se anulará y eliminará el gasto de retención del 4% asignado a esta venta.
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={updatingPayment}>
                  {updatingPayment ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingSale(null)} disabled={updatingPayment}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Cancelación de Venta */}
      {cancellingSale && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <Card title={`Cancelar Venta #${cancellingSale.sale_number}`} style={{ minWidth: '400px', maxWidth: '450px' }}>
            <form onSubmit={handleCancelSale}>
              {cancelError && <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{cancelError}</p>}
              
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>Fecha:</span>
                  <strong>{new Date(cancellingSale.date).toLocaleString('es-AR')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>Monto Total:</span>
                  <strong>${parseFloat(cancellingSale.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Forma de Pago:</span>
                  <strong>{cancellingSale.payment_method}</strong>
                </div>
              </div>

              <div style={{
                marginBottom: '1.25rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)', borderLeft: '3px solid #f59e0b',
                fontSize: '0.85rem', color: '#92400e'
              }}>
                ⚠️ Esta acción es irreversible. Se restaurará el stock a los lotes originales y se anularán todos los registros financieros de esta venta (incluidos impuestos de retención si correspondiera).
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Motivo de la Cancelación</label>
                <select 
                  className={styles.paymentSelect}
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  required
                >
                  <option value="Error en la carga">Error en la carga / Carga duplicada</option>
                  <option value="Devolución del cliente">Devolución de mercadería</option>
                  <option value="Cambio de producto">Cambio de artículo</option>
                  <option value="Otro">Otro motivo (especificar)</option>
                </select>
              </div>

              {cancellationReason === 'Otro' && (
                <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Detalle del Motivo</label>
                  <textarea
                    style={{
                      width: '100%', minHeight: '80px', padding: '8px', 
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-background)', color: 'var(--color-text)',
                      marginTop: '4px', resize: 'vertical'
                    }}
                    placeholder="Escriba el motivo detallado..."
                    value={customReasonText}
                    onChange={e => setCustomReasonText(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <Button type="submit" variant="danger" style={{ flex: 1, backgroundColor: '#ef4444' }} disabled={cancellingStatus}>
                  {cancellingStatus ? 'Cancelando...' : 'Confirmar Cancelación'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setCancellingSale(null)} disabled={cancellingStatus}>
                  Atrás
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
