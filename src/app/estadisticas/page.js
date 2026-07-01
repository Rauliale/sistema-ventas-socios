'use client';

import React, { useState } from 'react';
import { useStatistics } from '../../hooks/useStatistics';
import { Card } from '../../components/ui/Card';
import styles from './page.module.css';

export default function StatisticsPage() {
  const [period, setPeriod] = useState('month');
  const { stats, loading, error } = useStatistics(period);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
  };

  const formatPercent = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(val);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Estadísticas y BI</h1>
        <div>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
          >
            <option value="day">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
          </select>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</div>}
      
      {loading || !stats ? (
        <div>Cargando métricas...</div>
      ) : (
        <>
          <div className={styles.dashboardGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Ventas Totales</div>
              <div className={`${styles.statValue} ${styles.primary}`}>
                {formatCurrency(stats.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                {stats.salesCount} transacciones
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>Ganancia Neta (Exacta)</div>
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

            <div className={styles.statCard} style={{ borderLeft: '4px solid var(--color-danger)' }}>
              <div className={styles.statTitle}>Punto de Equilibrio</div>
              <div className={`${styles.statValue} ${styles.danger}`}>
                {formatCurrency(stats.breakEvenPoint)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                Gastos del periodo: {formatCurrency(stats.totalExpenses)}
              </div>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Proyecciones del Mes (Base a ritmo actual)</h2>
          <div className={styles.dashboardGrid}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h2 className={styles.sectionTitle}>Producto Estrella (Demanda)</h2>
              <Card>
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
                    {stats.topProduct.name}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
                    <strong>{stats.topProduct.quantity}</strong> unidades vendidas
                  </p>
                </div>
              </Card>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>Participación de Socios (Histórico Total)</h2>
              <div className={styles.tableContainer} style={{ padding: '1rem' }}>
                {Object.entries(stats.partnerInvestments).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>No hay compras registradas en este período</div>
                ) : (
                  <div>
                    {(() => {
                      const totalInvestment = Object.values(stats.partnerInvestments).reduce((a, b) => a + b, 0);
                      
                      return Object.entries(stats.partnerInvestments).map(([partner, amount], index) => {
                        const percentage = totalInvestment > 0 ? ((amount / totalInvestment) * 100).toFixed(1) : 0;
                        const colors = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)'];
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
                            <div style={{ width: '100%', backgroundColor: 'var(--color-background)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
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
          </div>
        </>
      )}
    </div>
  );
}
