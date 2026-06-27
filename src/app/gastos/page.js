'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useExpenses } from '../../hooks/useExpenses';

export default function Gastos() {
  const { expenses, categories, loading, addExpense } = useExpenses();
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    description: '',
    category_id: '',
    amount: 0,
    shared_type: '50/50'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id) {
      alert("Debes seleccionar una categoría");
      return;
    }
    
    try {
      await addExpense({
        description: formData.description,
        category_id: formData.category_id,
        amount: parseFloat(formData.amount),
        shared_type: formData.shared_type
      });
      setShowForm(false);
      setFormData({ description: '', category_id: '', amount: 0, shared_type: '50/50' });
    } catch (err) {
      alert("Error al registrar gasto: " + err.message);
    }
  };

  const columns = [
    { header: 'Fecha', accessor: 'date', render: row => new Date(row.date).toLocaleDateString() },
    { header: 'Categoría', accessor: 'categoryName', render: row => row.expense_categories?.name },
    { header: 'Descripción', accessor: 'description' },
    { header: 'Importe ($)', accessor: 'amount' },
    { header: 'Distribución', accessor: 'shared_type' }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Control de Gastos</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Registrar Gasto'}
        </Button>
      </div>

      {showForm && (
        <Card title="Nuevo Gasto" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Categoría</label>
              <select 
                value={formData.category_id}
                onChange={e => setFormData({...formData, category_id: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                required
              >
                <option value="">Selecciona...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <Input label="Descripción" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required style={{flex: '2 1 300px'}} />
            <Input label="Importe ($)" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required style={{flex: '1 1 100px'}} />
            
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Reparto (Raúl/Nahuel)</label>
              <select 
                value={formData.shared_type}
                onChange={e => setFormData({...formData, shared_type: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="50/50">50/50 (Mitades)</option>
                <option value="60/40">60% Raúl / 40% Nahuel</option>
                <option value="40/60">40% Raúl / 60% Nahuel</option>
                <option value="100/0">100% Raúl</option>
                <option value="0/100">100% Nahuel</option>
              </select>
            </div>
            
            <div style={{ width: '100%', marginTop: '1rem' }}>
              <Button type="submit">Guardar Gasto</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Historial de Gastos">
        {loading ? (
          <p>Cargando gastos...</p>
        ) : (
          <Table columns={columns} data={expenses} />
        )}
      </Card>
    </div>
  );
}
