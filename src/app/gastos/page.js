'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useExpenses } from '../../hooks/useExpenses';
import { useLoans } from '../../hooks/useLoans';
import { usePersonalExpenses } from '../../hooks/usePersonalExpenses';

export default function Gastos() {
  const [activeTab, setActiveTab] = useState('gastos'); // 'gastos' | 'prestamos'
  
  // ================= EXPENDITURES STATE =================
  const { expenses, categories, loading, error, addExpense, markExpenseAsPaid, updateExpenseAmount, splitExpense } = useExpenses();
  const [showExpForm, setShowExpForm] = useState(false);
  const [expFormData, setExpFormData] = useState({
    description: '',
    category_id: '',
    amount: '',
    shared_type: '50/50',
    payment_method: 'Efectivo'
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitExpenseId, setSplitExpenseId] = useState(null);
  const [splitParts, setSplitParts] = useState([{ amount: '', payment_method: 'Efectivo' }]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitOriginalAmount, setSplitOriginalAmount] = useState(0);

  const handleExpSubmit = async (e) => {
    e.preventDefault();
    if (!expFormData.category_id) return alert("Debes seleccionar una categoría");
    try {
      const isCash = (expFormData.payment_method === 'Efectivo' || expFormData.payment_method === 'Caja Comun' || !expFormData.payment_method);
      await addExpense({
        description: expFormData.description,
        category_id: expFormData.category_id,
        amount: parseFloat(expFormData.amount),
        shared_type: expFormData.shared_type,
        payment_method: expFormData.payment_method || 'Efectivo',
        paid_from_register: isCash,
        status: 'paid'
      });
      setShowExpForm(false);
      setExpFormData({ description: '', category_id: '', amount: 0, shared_type: '50/50', payment_method: 'Efectivo' });
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
      alert("Error al actualizar: " + err.message);
    }
  };

  const handleAddSplitPart = () => {
    setSplitParts([...splitParts, { amount: '', payment_method: 'Efectivo' }]);
  };

  const handleRemoveSplitPart = (index) => {
    setSplitParts(splitParts.filter((_, i) => i !== index));
  };

  const handleSplitPartChange = (index, field, value) => {
    const newParts = [...splitParts];
    newParts[index][field] = value;
    setSplitParts(newParts);
  };

  const handleSplitSubmit = async (e) => {
    e.preventDefault();
    if (splitParts.length < 2) return alert("Debes agregar al menos 2 partes");
    
    let total = 0;
    for (let p of splitParts) {
      if (!p.amount || isNaN(p.amount)) return alert("Monto inválido en una de las partes");
      total += parseFloat(p.amount);
    }
    
    if (Math.abs(total - splitOriginalAmount) > 0.01) {
       const confirm = window.confirm(`El total dividido ($${total}) no coincide con el original ($${splitOriginalAmount}). ¿Deseas continuar y cambiar el total del gasto?`);
       if (!confirm) return;
    }

    try {
      setSplitSubmitting(true);
      await splitExpense(splitExpenseId, splitParts);
      setShowSplitModal(false);
      setSplitExpenseId(null);
    } catch (err) {
      alert("Error al dividir el gasto: " + err.message);
    } finally {
      setSplitSubmitting(false);
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
             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
               <Button onClick={() => { setEditingExpenseId(row.id); setEditAmount(row.amount); }}>Editar</Button>
               <Button style={{ background: 'var(--color-secondary)' }} onClick={() => {
                 setSplitExpenseId(row.id);
                 setSplitOriginalAmount(row.amount);
                 setSplitParts([
                   { amount: row.amount, payment_method: 'Efectivo' },
                   { amount: '', payment_method: 'Transferencia' }
                 ]);
                 setShowSplitModal(true);
               }}>Dividir</Button>
             </div>
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

  // ================= PERSONAL EXPENSES STATE =================
  const { personalExpenses, loading: loadingPersonal, addPersonalExpense } = usePersonalExpenses();
  const [showPersonalForm, setShowPersonalForm] = useState(false);
  const [personalFormData, setPersonalFormData] = useState({
    description: '',
    amount: '',
    payment_method: 'Efectivo'
  });

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    try {
      await addPersonalExpense({
        description: personalFormData.description,
        amount: parseFloat(personalFormData.amount),
        payment_method: personalFormData.payment_method
      });
      setShowPersonalForm(false);
      setPersonalFormData({ description: '', amount: '', payment_method: 'Efectivo' });
      alert("Gasto personal registrado exitosamente");
    } catch (err) {
      alert("Error al registrar gasto personal: " + err.message);
    }
  };

  const personalColumns = [
    { header: 'Fecha', accessor: 'created_at', render: row => new Date(row.created_at).toLocaleDateString() },
    { header: 'Descripción', accessor: 'description' },
    { header: 'Importe ($)', accessor: 'amount' },
    { header: 'Forma de Pago', accessor: 'payment_method' }
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>{activeTab === 'gastos' ? 'Control de Gastos' : activeTab === 'prestamos' ? 'Agenda de Préstamos' : 'Gastos Personales'}</h1>
        
        {activeTab === 'gastos' && (
          <Button onClick={() => setShowExpForm(!showExpForm)}>
            {showExpForm ? 'Cancelar' : 'Registrar Gasto'}
          </Button>
        )}
        {activeTab === 'prestamos' && (
          <Button onClick={() => setShowLoanForm(!showLoanForm)}>
            {showLoanForm ? 'Cancelar' : 'Cargar Préstamo'}
          </Button>
        )}
        {activeTab === 'personales' && (
          <Button onClick={() => setShowPersonalForm(!showPersonalForm)}>
            {showPersonalForm ? 'Cancelar' : 'Registrar Gasto Personal'}
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
        <button 
          onClick={() => setActiveTab('personales')}
          style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: activeTab === 'personales' ? 'bold' : 'normal', color: activeTab === 'personales' ? 'var(--color-primary)' : 'var(--color-text-secondary)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Gastos Personales
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
                  <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--color-text-secondary)' }}>Forma de Pago</label>
                  <select
                    value={expFormData.payment_method}
                    onChange={(e) => setExpFormData({ ...expFormData, payment_method: e.target.value })}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="Efectivo">💵 Efectivo (Caja Diaria)</option>
                    <option value="Caja Comun">💰 Efectivo (Caja Común)</option>
                    <option value="Transferencia">🏦 Transferencia</option>
                  </select>
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
            {loading ? <p>Cargando gastos...</p> : <Table columns={expColumns} data={expenses} />}
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

      {/* PERSONALES TAB */}
      {activeTab === 'personales' && (
        <>
          {showPersonalForm && (
            <Card title="Nuevo Gasto Personal" style={{ marginBottom: '2rem' }}>
              <form onSubmit={handlePersonalSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input label="Descripción breve *" value={personalFormData.description} onChange={e => setPersonalFormData({...personalFormData, description: e.target.value})} required />
                  </div>
                  <div>
                    <Input label="Monto *" type="number" step="0.01" value={personalFormData.amount} onChange={e => setPersonalFormData({...personalFormData, amount: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Forma de Pago</label>
                    <select 
                      value={personalFormData.payment_method}
                      onChange={e => setPersonalFormData({...personalFormData, payment_method: e.target.value})}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                    >
                      <option value="Efectivo">💵 Efectivo</option>
                      <option value="Transferencia">🏦 Transferencia</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <Button type="submit">Guardar Gasto Personal</Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Mis Gastos Personales">
            {loadingPersonal ? <p>Cargando gastos personales...</p> : <Table columns={personalColumns} data={personalExpenses} />}
          </Card>
        </>
      )}

      {showSplitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--color-surface, #fff)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text)' }}>Dividir Pago de Gasto</h2>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--color-text-secondary)' }} onClick={() => setShowSplitModal(false)}>
                X
              </button>
            </div>
            
            <form onSubmit={handleSplitSubmit}>
              <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Total original: <strong>${parseFloat(splitOriginalAmount).toLocaleString('es-AR')}</strong>
                <br/>
                Total actualizado: <strong>${splitParts.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toLocaleString('es-AR')}</strong>
              </p>

              {splitParts.map((part, index) => (
                <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', background: 'var(--color-background-secondary)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--color-text-secondary)' }}>Monto de Parte {index + 1}</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={part.amount} 
                      onChange={(e) => handleSplitPartChange(index, 'amount', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--color-text-secondary)' }}>Forma de Pago</label>
                    <select
                      value={part.payment_method}
                      onChange={(e) => handleSplitPartChange(index, 'payment_method', e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                    >
                      <option value="Efectivo">💵 Efectivo (Caja Diaria)</option>
                      <option value="Caja Comun">💰 Efectivo (Caja Común)</option>
                      <option value="Transferencia">🏦 Transferencia / Banco</option>
                    </select>
                  </div>
                  {splitParts.length > 2 && (
                    <Button type="button" onClick={() => handleRemoveSplitPart(index)} style={{ background: 'var(--color-danger)', marginBottom: '4px' }}>X</Button>
                  )}
                </div>
              ))}
              
              <Button type="button" onClick={handleAddSplitPart} style={{ marginBottom: '1.5rem', background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                + Añadir otra forma de pago
              </Button>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <Button type="button" onClick={() => setShowSplitModal(false)} style={{ background: 'var(--color-background-secondary)', color: 'var(--color-text)' }}>Cancelar</Button>
                <Button type="submit" disabled={splitSubmitting}>
                  {splitSubmitting ? 'Procesando...' : 'Dividir Gasto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
