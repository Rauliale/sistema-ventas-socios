'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useExpenses } from '../../hooks/useExpenses';
import { useLoans } from '../../hooks/useLoans';

export default function Gastos() {
  const [activeTab, setActiveTab] = useState('gastos'); // 'gastos' | 'prestamos'
  
  // ================= EXPENDITURES STATE =================
  const { expenses, categories, loading: loadingExp, addExpense, markExpenseAsPaid, updateExpenseAmount } = useExpenses();
  const [showExpForm, setShowExpForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [expFormData, setExpFormData] = useState({
    description: '',
    category_id: '',
    amount: 0,
    shared_type: '50/50'
  });

  const handleExpSubmit = async (e) => {
    e.preventDefault();
    if (!expFormData.category_id) return alert("Debes seleccionar una categoría");
    try {
      await addExpense({
        description: expFormData.description,
        category_id: expFormData.category_id,
        amount: parseFloat(expFormData.amount),
        shared_type: expFormData.shared_type
      });
      setShowExpForm(false);
      setExpFormData({ description: '', category_id: '', amount: 0, shared_type: '50/50' });
    } catch (err) {
      alert("Error al registrar gasto: " + err.message);
    }
  };

  const handleEditAmountSubmit = async (expenseId) => {
    if (!editAmount || isNaN(editAmount)) return alert("Importe inválido");
    try {
      await updateExpenseAmount(expenseId, editAmount);
      setEditingExpenseId(null);
      setEditAmount('');
    } catch (err) {
      alert("Error al editar gasto: " + err.message);
    }
  };


  const expColumns = [
    { header: 'Fecha', accessor: 'date', render: row => new Date(row.date).toLocaleDateString() },
    { header: 'Categoría', accessor: 'categoryName', render: row => row.expense_categories?.name },
    { header: 'Descripción', accessor: 'description' },
    { header: 'Importe ($)', accessor: 'amount', render: row => (
        <div>
          {row.amount}
          {row.is_edited && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>
              (Editado, antes: ${row.original_amount})
            </div>
          )}
        </div>
    )},
    { header: 'Distribución', accessor: 'shared_type' },
    { header: 'Estado', accessor: 'status', render: row => (
        <span style={{ color: row.status === 'paid' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
          {row.status === 'paid' ? 'Saldado' : 'Pendiente'}
        </span>
    )},
    { header: 'Acción', accessor: 'action', render: row => (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {row.status === 'pending' && (
            <Button onClick={() => markExpenseAsPaid(row.id)}>Saldar</Button>
          )}
          {editingExpenseId === row.id ? (
             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
               <input 
                 type="number" 
                 step="0.01" 
                 value={editAmount} 
                 onChange={(e) => setEditAmount(e.target.value)} 
                 style={{ width: '80px', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
               />
               <Button onClick={() => handleEditAmountSubmit(row.id)}>Ok</Button>
               <Button onClick={() => setEditingExpenseId(null)} style={{ background: 'var(--color-danger)' }}>X</Button>
             </div>
          ) : (
             <Button onClick={() => { setEditingExpenseId(row.id); setEditAmount(row.amount); }}>Editar</Button>
          )}
        </div>
    )}
  ];

  // ================= LOANS STATE =================
  const { installments, partners, loading: loadingLoans, createLoan, markInstallmentAsPaid } = useLoans();
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanFormData, setLoanFormData] = useState({
    partner_id: '',
    description: '',
    total_amount: '',
    installments: '',
    installment_amt: '',
    first_due_date: ''
  });

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    if (!loanFormData.partner_id) return alert("Selecciona un socio");
    try {
      await createLoan({
        p_partner_id: loanFormData.partner_id,
        p_description: loanFormData.description,
        p_total_amount: parseFloat(loanFormData.total_amount),
        p_installments: parseInt(loanFormData.installments, 10),
        p_installment_amt: parseFloat(loanFormData.installment_amt),
        p_first_due_date: loanFormData.first_due_date
      });
      setShowLoanForm(false);
      setLoanFormData({ partner_id: '', description: '', total_amount: '', installments: '', installment_amt: '', first_due_date: '' });
      alert("Préstamo y cuotas registrados exitosamente");
    } catch (err) {
      alert("Error al registrar préstamo: " + err.message);
    }
  };

  const loanColumns = [
    { header: 'Vencimiento', accessor: 'due_date', render: row => new Date(row.due_date).toLocaleDateString() + ' (Faltan ' + Math.ceil((new Date(row.due_date) - new Date()) / (1000 * 60 * 60 * 24)) + ' días)' },
    { header: 'Socio', accessor: 'partner', render: row => row.loans?.partners?.name },
    { header: 'Entidad / Detalle', accessor: 'description', render: row => row.loans?.description },
    { header: 'Importe ($)', accessor: 'amount' },
    { header: 'Estado', accessor: 'status', render: row => (
        <span style={{ color: row.status === 'paid' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
          {row.status === 'paid' ? 'Pagado' : 'Pendiente'}
        </span>
    )},
    { header: 'Acción', accessor: 'action', render: row => (
        row.status === 'pending' ? (
          <Button onClick={() => markInstallmentAsPaid(row.id)}>Pagar</Button>
        ) : null
    )}
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>{activeTab === 'gastos' ? 'Control de Gastos' : 'Agenda de Préstamos'}</h1>
        
        {activeTab === 'gastos' ? (
          <Button onClick={() => setShowExpForm(!showExpForm)}>
            {showExpForm ? 'Cancelar' : 'Registrar Gasto'}
          </Button>
        ) : (
          <Button onClick={() => setShowLoanForm(!showLoanForm)}>
            {showLoanForm ? 'Cancelar' : 'Cargar Préstamo'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-background)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('gastos')}
          style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: activeTab === 'gastos' ? 'bold' : 'normal', color: activeTab === 'gastos' ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Gastos Operativos
        </button>
        <button 
          onClick={() => setActiveTab('prestamos')}
          style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: activeTab === 'prestamos' ? 'bold' : 'normal', color: activeTab === 'prestamos' ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Agenda de Préstamos
        </button>
      </div>

      {/* GASTOS TAB */}
      {activeTab === 'gastos' && (
        <>
          {showExpForm && (
            <Card title="Nuevo Gasto" style={{ marginBottom: '2rem' }}>
              <form onSubmit={handleExpSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Categoría *</label>
                    <select 
                      value={expFormData.category_id}
                      onChange={e => setExpFormData({...expFormData, category_id: e.target.value})}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input label="Descripción *" value={expFormData.description} onChange={e => setExpFormData({...expFormData, description: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Importe ($) *" type="number" step="0.01" value={expFormData.amount} onChange={e => setExpFormData({...expFormData, amount: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Reparto (Raúl/Nahuel)</label>
                    <select 
                      value={expFormData.shared_type}
                      onChange={e => setExpFormData({...expFormData, shared_type: e.target.value})}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                    >
                      <option value="50/50">50/50 (Mitades)</option>
                      <option value="60/40">60% Raúl / 40% Nahuel</option>
                      <option value="40/60">40% Raúl / 60% Nahuel</option>
                      <option value="100/0">100% Raúl</option>
                      <option value="0/100">100% Nahuel</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <Button type="submit">Guardar Gasto</Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Historial de Gastos">
            {loadingExp ? <p>Cargando gastos...</p> : <Table columns={expColumns} data={expenses} />}
          </Card>
        </>
      )}

      {/* PRESTAMOS TAB */}
      {activeTab === 'prestamos' && (
        <>
          {showLoanForm && (
            <Card title="Registrar Préstamo" style={{ marginBottom: '2rem' }}>
              <form onSubmit={handleLoanSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Socio Titular *</label>
                    <select 
                      value={loanFormData.partner_id}
                      onChange={e => setLoanFormData({...loanFormData, partner_id: e.target.value})}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input label="Entidad (Ej: Tarjeta Naranja) *" value={loanFormData.description} onChange={e => setLoanFormData({...loanFormData, description: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Monto Total Prestado *" type="number" step="0.01" value={loanFormData.total_amount} onChange={e => setLoanFormData({...loanFormData, total_amount: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Cantidad de Cuotas *" type="number" step="1" min="1" value={loanFormData.installments} onChange={e => setLoanFormData({...loanFormData, installments: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Valor por Cuota ($) *" type="number" step="0.01" value={loanFormData.installment_amt} onChange={e => setLoanFormData({...loanFormData, installment_amt: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Vto. de 1ra Cuota *" type="date" value={loanFormData.first_due_date} onChange={e => setLoanFormData({...loanFormData, first_due_date: e.target.value})} required />
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <Button type="submit">Generar Préstamo y Cuotas</Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Próximos Vencimientos">
            {loadingLoans ? <p>Cargando agenda...</p> : (
              <Table 
                columns={loanColumns} 
                data={installments.filter(i => i.status === 'pending').concat(installments.filter(i => i.status === 'paid'))} 
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
