'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { db } from '../../lib/supabase';

export default function Finanzas() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFinances() {
      try {
        setLoading(true);
        const partners = await db.get('partners');
        const pMap = {};
        partners.forEach(p => pMap[p.id] = p.name);

        const { supabase } = await import('../../lib/supabase');
        const { data } = await supabase
          .from('financial_movements')
          .select('*')
          .order('date', { ascending: false });
        
        const tableData = (data || []).map(m => ({
          ...m,
          partnerName: pMap[m.partner_id] || 'Desconocido',
          dateFmt: new Date(m.date).toLocaleString(),
          amountFmt: `$${m.amount.toFixed(2)}`
        }));

        setMovements(tableData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadFinances();
  }, []);

  const columns = [
    { header: 'Fecha', accessor: 'dateFmt' },
    { header: 'Socio', accessor: 'partnerName' },
    { header: 'Operación', accessor: 'type' },
    { header: 'Importe', accessor: 'amountFmt' }
  ];

  return (
    <div className="page-container">
      <h1>Reporte Financiero</h1>
      <Card title="Historial Completo de Movimientos">
        {loading ? (
          <p>Cargando finanzas...</p>
        ) : (
          <Table columns={columns} data={movements} />
        )}
      </Card>
    </div>
  );
}
