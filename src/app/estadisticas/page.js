'use client';

import React, { useState } from 'react';
import { useStatistics } from '../../hooks/useStatistics';
import { Card } from '../../components/ui/Card';
import styles from './page.module.css';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function StatisticsPage() {
  const [period, setPeriod] = useState('month');
  const { stats, loading, error } = useStatistics(period);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
  };

  const formatPercent = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(val || 0);
  };

  const generateMonthOptions = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const options = [];

    // Past 12 months
    for (let i = 0; i < 12; i++) {
      let d = new Date(currentYear, currentMonth - i, 1);
      let y = d.getFullYear();
      let mIdx = d.getMonth();
      let monthNum = String(mIdx + 1).padStart(2, '0');
      let val = `${y}-${monthNum}`;
      let label = `${MONTH_NAMES[mIdx]} ${y}`;
      options.push({ value: val, label });
    }

    return options;
  };

  const displayPeriodLabel = stats?.periodLabel || 'Este Mes';

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Estadísticas y BI</h1>
        <div>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{ 
              padding: '0.6rem 1rem', 
              borderRadius: '6px', 
              border: '1px solid var(--color-border)', 
              fontSize: '1rem', 
              fontWeight: '500',
              backgroundColor: 'var(--color-surface)',
              cursor: 'pointer'
            }}
          >
            <optgroup label="Filtros Rápidos">
              <option value="day">Hoy</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mes Actual</option>
            </optgroup>
            <optgroup label="Histórico por Mes">
              {generateMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</div>}
      
      {loading || !stats ? (
        <div>Cargando métricas...</div>
      ) : (
        <>
          {/* SECCIÓN 1: DINERO EN CAJA Y FONDOS POR MEDIO DE PAGO */}
          <h2 className={styles.sectionTitle}>💰 Dinero en Caja y Fondos ({displayPeriodLabel})</h2>
          <div className={styles.dashboardGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.statCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
              <div className={styles.statTitle}>Efectivo en Caja ({displayPeriodLabel})</div>
              <div className={`${styles.statValue} ${stats.netCashBalance >= 0 ? styles.success : styles.danger}`}>
                {formatCurrency(stats.netCashBalance)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Ingresos Cash: {formatCurrency(stats.salesCash)} | Gastos Cash: -{formatCurrency(stats.expensesCash)}
              </div>
            </div>

            <div className={styles.statCard} style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div className={styles.statTitle}>Transferencias / Banco ({displayPeriodLabel})</div>
              <div className={`${styles.statValue} ${stats.netTransferBalance >= 0 ? styles.primary : styles.danger}`}>
                {formatCurrency(stats.netTransferBalance)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Ingresos Digitales: {formatCurrency(stats.salesTransfer)} | Gastos: -{formatCurrency(stats.expensesTransfer)}
              </div>
            </div>

            <div className={styles.statCard} style={{ borderLeft: '4px solid var(--color-danger)' }}>
              <div className={styles.statTitle}>Gastos Totales ({displayPeriodLabel})</div>
              <div className={`${styles.statValue} ${styles.danger}`}>
                {formatCurrency(stats.totalExpenses)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Punto de Equilibrio: {formatCurrency(stats.breakEvenPoint)}
              </div>
            </div>
          </div>

          {/* DESGLOSE POR MEDIO DE PAGO */}
          <div style={{ marginBottom: '2.5rem' }}>
            <Card title={`💳 Ventas por Medio de Pago (${displayPeriodLabel})`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '0.5rem 0' }}>
                {Object.entries(stats.salesByPaymentMethod).length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)' }}>Sin ventas registradas en este período.</p>
                ) : (
                  Object.entries(stats.salesByPaymentMethod).map(([method, amount]) => (
                    <div key={method} style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-primary)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{method}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '4px' }}>
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* SECCIÓN 2: VALORIZACIÓN TOTAL DE MERCADERÍA / INVENTARIO */}
          <h2 className={styles.sectionTitle}>📦 Plata en Mercadería (Inventario Actual)</h2>
          <div className={styles.dashboardGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.statCard} style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className={styles.statTitle}>Total Invertido en Mercadería (Al Costo)</div>
              <div className={styles.statValue} style={{ color: '#8b5cf6' }}>
                {formatCurrency(stats.totalInventoryCost)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Capital invertido en stock disponible
              </div>
            </div>

            <div className={styles.statCard} style={{ borderLeft: '4px solid #ec4899' }}>
              <div className={styles.statTitle}>Valor Potencial a Precio de Venta</div>
              <div className={styles.statValue} style={{ color: '#ec4899' }}>
                {formatCurrency(stats.totalInventorySaleValue)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Recaudación si se vende todo el stock
              </div>
            </div>

            <div className={styles.statCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
              <div className={styles.statTitle}>Ganancia Potencial en Stock</div>
              <div className={`${styles.statValue} ${styles.success}`}>
                {formatCurrency(stats.totalInventorySaleValue - stats.totalInventoryCost)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Margen proyectado de la mercadería
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: MÉTRICAS GENERALES DE VENTAS Y GANANCIAS */}
          <h2 className={styles.sectionTitle}>📊 Rendimiento General ({displayPeriodLabel})</h2>
          <div className={styles.dashboardGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Ventas Totales</div>
              <div className={`${styles.statValue} ${styles.primary}`}>
                {formatCurrency(stats.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                {stats.salesCount} transacciones realizadas
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Ganancia Neta (Exacta FIFO)</div>
              <div className={`${styles.statValue} ${styles.success}`}>
                {formatCurrency(stats.totalNetProfit)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Margen Real: {formatPercent(stats.profitMarginPercentage)}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Ticket Promedio</div>
              <div className={styles.statValue}>
                {formatCurrency(stats.averageTicket)}
              </div>
            </div>
          </div>

          {/* GASTOS POR CATEGORÍA */}
          {Object.keys(stats.expensesByCategory).length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <Card title={`💸 Gastos Desglosados por Categoría (${displayPeriodLabel})`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {Object.entries(stats.expensesByCategory).map(([cat, amount]) => (
                    <div key={cat} style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-danger)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{cat}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: '4px' }}>
                        {formatCurrency(amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* PROYECCIONES */}
          <h2 className={styles.sectionTitle}>📈 Proyecciones ({displayPeriodLabel})</h2>
          <div className={styles.dashboardGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Promedio Ventas Diario</div>
              <div className={`${styles.statValue} ${styles.warning}`}>
                {formatCurrency(stats.averageDailySales)}
              </div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Proyección Ventas (24 Días)</div>
              <div className={`${styles.statValue} ${styles.warning}`}>
                {formatCurrency(stats.projectedSales)}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Proyección Ganancia Neta</div>
              <div className={`${styles.statValue} ${styles.success}`}>
                {formatCurrency(stats.projectedMargin)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Usando margen real ({formatPercent(stats.profitMarginPercentage)})
              </div>
            </div>
          </div>

          {/* TABLAS TOP PRODUCTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <h2 className={styles.sectionTitle}>Top 10: Más Vendidos (Volumen)</h2>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'center' }}>Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProductsByQuantity && stats.topProductsByQuantity.length > 0 ? (
                      stats.topProductsByQuantity.map((product, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}. <strong>{product.name}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                              {product.quantity}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="2" style={{ textAlign: 'center' }}>Sin ventas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>Top 10: Más Rentables (Ganancia)</h2>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ textAlign: 'right' }}>Ganancia Neta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProductsByProfit && stats.topProductsByProfit.length > 0 ? (
                      stats.topProductsByProfit.map((product, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}. <strong>{product.name}</strong></td>
                          <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 'bold' }}>
                            {formatCurrency(product.profit)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="2" style={{ textAlign: 'center' }}>Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VALORIZACIÓN DE STOCK POR SOCIO */}
          <div>
            <h2 className={styles.sectionTitle}>Valorización de Stock por Socio</h2>
            <div className={styles.tableContainer} style={{ padding: '1rem' }}>
              {Object.entries(stats.partnerInvestments).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>No hay compras registradas en este período</div>
              ) : (
                <div>
                  {(() => {
                    const totalInvestment = Object.values(stats.partnerInvestments).reduce((a, b) => a + b, 0);
                    
                    return Object.entries(stats.partnerInvestments).map(([partner, amount], index) => {
                      const percentage = totalInvestment > 0 ? ((amount / totalInvestment) * 100).toFixed(1) : 0;
                      const colors = ['var(--color-primary)', 'var(--color-success)', '#f59e0b'];
                      const color = colors[index % colors.length];

                      return (
                        <div key={partner} style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong>{partner}</strong>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 'bold', marginRight: '1rem' }}>{percentage}%</span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(amount)}</span>
                            </div>
                          </div>
                          <div style={{ width: '100%', backgroundColor: 'var(--color-border)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${percentage}%`, 
                                backgroundColor: color, 
                                height: '100%',
                                transition: 'width 0.5s ease-in-out'
                              }} 
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
