'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { supabase, db } from '../lib/supabase';

const TYPE_LABELS = {
  profit: 'Ganancia',
  investment: 'Inversión',
  expense: 'Gasto',
  withdrawal: 'Retiro'
};

const TYPE_COLORS = {
  profit: 'var(--color-secondary)',
  investment: 'var(--color-primary)',
  expense: 'var(--color-danger)',
  withdrawal: '#f59e0b'
};

export default function Dashboard() {
  const [partnerStats, setPartnerStats] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Obtener socios
      const partners = await db.get('partners');

      // Calcular totales por socio agrupando movimientos
      const statsPromises = partners.map(async (partner) => {
        const { data } = await supabase
          .from('financial_movements')
          .select('type, amount')
          .eq('partner_id', partner.id);

        const totals = (data || []).reduce((acc, mov) => {
          acc[mov.type] = (acc[mov.type] || 0) + parseFloat(mov.amount);
          return acc;
        }, {});

        // Utilidad neta = ganancias + inversiones + gastos (todos ya están con signo)
        const netBalance = Object.values(totals).reduce((a, b) => a + b, 0);

        return {
          id: partner.id,
          name: partner.name,
          profit: totals.profit || 0,
          investment: totals.investment || 0,
          expense: totals.expense || 0,
          withdrawal: totals.withdrawal || 0,
          netBalance
        };
      });

      const stats = await Promise.all(statsPromises);
      setPartnerStats(stats);

      // Últimos 15 movimientos
      const { data: recentMovs } = await supabase
        .from('financial_movements')
        .select('*, partners(name)')
        .order('date', { ascending: false })
        .limit(15);

      setMovements((recentMovs || []).map(m => ({
        ...m,
        partnerName: m.partners?.name || '-',
        typeLabel: TYPE_LABELS[m.type] || m.type,
        dateFmt: new Date(m.date).toLocaleString('es-AR'),
        amountFmt: `$${Math.abs(parseFloat(m.amount)).toFixed(2)}`
      })));
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const movColumns = [
    { header: 'Fecha', accessor: 'dateFmt' },
    { header: 'Socio', accessor: 'partnerName' },
    {
      header: 'Tipo',
      accessor: 'typeLabel',
      render: row => (
        <span style={{ color: TYPE_COLORS[row.type], fontWeight: 600 }}>
          {row.typeLabel}
        </span>
      )
    },
    {
      header: 'Importe',
      accessor: 'amountFmt',
      render: row => (
        <span style={{ color: parseFloat(row.amount) >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)', fontWeight: 500 }}>
          {parseFloat(row.amount) >= 0 ? '+' : '-'}{row.amountFmt}
        </span>
      )
    }
  ];

  if (loading) return <div className="page-container"><p>Cargando dashboard...</p></div>;

  return (
    <div className="page-container">
      <h1>Dashboard General</h1>

      {/* Tarjetas de resumen por socio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {partnerStats.map(p => (
          <Card key={p.id} title={`📊 ${p.name}`}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <MetricItem label="Ganancias" value={p.profit} color="var(--color-secondary)" />
              <MetricItem label="Invertido" value={p.investment} color="var(--color-primary)" />
              <MetricItem label="Gastos" value={p.expense} color="var(--color-danger)" />
              <MetricItem label="Retiros" value={p.withdrawal} color="#f59e0b" />
            </div>
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'var(--color-background)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Balance Neto</span>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: p.netBalance >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)'
              }}>
                {p.netBalance >= 0 ? '+' : ''}${p.netBalance.toFixed(2)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Últimos movimientos */}
      <Card title="Últimos Movimientos Financieros">
        {movements.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
            Sin movimientos registrados aún.
          </p>
        ) : (
          <Table columns={movColumns} data={movements} />
        )}
      </Card>
    </div>
  );
}

function MetricItem({ label, value, color }) {
  return (
    <div style={{
      padding: '0.5rem',
      backgroundColor: 'var(--color-background)',
      borderRadius: 'var(--radius-sm)',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color }}>${Math.abs(value).toFixed(2)}</div>
    </div>
  );
}
