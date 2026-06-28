'use client';

import React, { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { useSalesReports } from '../../hooks/useSalesReports';
import styles from './Reportes.module.css';

export default function ReportesVentas() {
  const {
    salesDetails,
    loading,
    error,
    dateFilter,
    setDateFilter,
    partnerFilter,
    setPartnerFilter
  } = useSalesReports();

  // Calcular totales
  const { totalRevenue, totalProfit, totalItems } = useMemo(() => {
    return salesDetails.reduce((acc, row) => ({
      totalRevenue: acc.totalRevenue + Number(row.total_revenue),
      totalProfit: acc.totalProfit + Number(row.net_profit),
      totalItems: acc.totalItems + Number(row.sold_quantity)
    }), { totalRevenue: 0, totalProfit: 0, totalItems: 0 });
  }, [salesDetails]);

  // Configuración de tabla
  const columns = [
    { header: 'Fecha', accessor: 'dateFmt', render: row => new Date(row.sale_date).toLocaleString() },
    { header: 'Venta #', accessor: 'sale_number' },
    { header: 'Dueño del Stock', accessor: 'partner_name' },
    { header: 'Producto', accessor: 'product_name' },
    { header: 'Cant.', accessor: 'sold_quantity' },
    { header: 'Ingreso', accessor: 'revFmt', render: row => `$${Number(row.total_revenue).toFixed(2)}` },
    { header: 'Ganancia Neta', accessor: 'profFmt', render: row => `$${Number(row.net_profit).toFixed(2)}` }
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
            <option value="all">Histórico Completo</option>
          </select>
        </div>

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

      <Card title="Detalle de Artículos Vendidos">
        {error && <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>}
        
        {loading ? (
          <p>Cargando reporte...</p>
        ) : (
          <Table columns={columns} data={salesDetails} />
        )}
      </Card>
    </div>
  );
}
