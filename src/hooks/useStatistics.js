import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getISOPeriodBounds(periodStr) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  let startIso, endIso;
  let isCurrentMonth = false;
  let daysPassed = 1;

  if (periodStr === 'day') {
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    startIso = `${y}-${m}-${d}T00:00:00.000Z`;
    endIso = `${y}-${m}-${d}T23:59:59.999Z`;
    daysPassed = 1;
  } else if (periodStr === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), diff + 6);
    
    const sy = startOfWeek.getFullYear();
    const sm = pad(startOfWeek.getMonth() + 1);
    const sd = pad(startOfWeek.getDate());

    const ey = endOfWeek.getFullYear();
    const em = pad(endOfWeek.getMonth() + 1);
    const ed = pad(endOfWeek.getDate());

    startIso = `${sy}-${sm}-${sd}T00:00:00.000Z`;
    endIso = `${ey}-${em}-${ed}T23:59:59.999Z`;
    daysPassed = Math.min(now.getDay() || 7, 7);
  } else if (periodStr === 'month' || periodStr === 'this_month') {
    isCurrentMonth = true;
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    
    startIso = `${y}-${m}-01T00:00:00.000Z`;
    endIso = `${y}-${m}-${pad(lastDay)}T23:59:59.999Z`;
    daysPassed = Math.max(1, now.getDate());
  } else if (periodStr.includes('-')) {
    const [y, mNum] = periodStr.split('-').map(Number);
    const m = pad(mNum);
    const lastDay = new Date(y, mNum, 0).getDate();
    
    startIso = `${y}-${m}-01T00:00:00.000Z`;
    endIso = `${y}-${m}-${pad(lastDay)}T23:59:59.999Z`;

    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    if (y === currentY && mNum === currentM) {
      isCurrentMonth = true;
      daysPassed = Math.max(1, now.getDate());
    } else {
      daysPassed = lastDay;
    }
  } else {
    isCurrentMonth = true;
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    
    startIso = `${y}-${m}-01T00:00:00.000Z`;
    endIso = `${y}-${m}-${pad(lastDay)}T23:59:59.999Z`;
    daysPassed = Math.max(1, now.getDate());
  }

  if (startIso < '2026-07-01T00:00:00.000Z') {
    startIso = '2026-07-01T00:00:00.000Z';
  }

  return { startIso, endIso, isCurrentMonth, daysPassed };
}

export function useStatistics(period = 'month') {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, [period]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startIso, endIso, isCurrentMonth, daysPassed } = getISOPeriodBounds(period);

      // 1. Fetch Sales Items from view
      const { data: saleItemsData, error: salesErr } = await supabase
        .from('vw_sales_details')
        .select('*')
        .gte('sale_date', startIso)
        .lte('sale_date', endIso);
        
      if (salesErr) throw salesErr;

      // 2. Fetch Unique Sales
      const { data: uniqueSalesData, error: uniqErr } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method, date, status')
        .gte('date', startIso)
        .lte('date', endIso);

      if (uniqErr) throw uniqErr;

      // 3. Fetch Expenses
      const { data: expensesData, error: expErr } = await supabase
        .from('expenses')
        .select('amount, paid_from_register, status, category_id, date, expense_categories(name)')
        .gte('date', startIso)
        .lte('date', endIso);

      if (expErr) throw expErr;

      // 4. Fetch All Active Product Lots for Mercadería / Stock Valuation
      const { data: lots, error: lotsErr } = await supabase
        .from('product_lots')
        .select('quantity, cost_price, partner_id, partners(name), products(sale_price)')
        .gt('quantity', 0);

      if (lotsErr) throw lotsErr;

      // 5. Fetch Financial Movements for Cash/Transfer net calculation
      const { data: finMovsData, error: finErr } = await supabase
        .from('financial_movements')
        .select('*')
        .gte('date', startIso)
        .lte('date', endIso);

      if (finErr) throw finErr;

      // 6. Fetch Technical Services Income for the month
      const periodMonth = startIso.substring(0, 7); // YYYY-MM
      const { data: techServicesData, error: techErr } = await supabase
        .from('technical_services_incomes')
        .select('amount, partners(name)')
        .eq('period_month', periodMonth);

      if (techErr) throw techErr;

      // 7. Fetch Purchases of the period
      const { data: periodPurchases, error: purchErr } = await supabase
        .from('purchases')
        .select('total_amount, partners(name)')
        .gte('date', startIso)
        .lte('date', endIso);

      if (purchErr) throw purchErr;

      // --- FILTERING (IN-MEMORY SAFE) ---
      const validSales = (uniqueSalesData || []).filter(s => 
        s.status !== 'pending' && s.status !== 'cancelled'
      );

      const validSaleItems = (saleItemsData || []).filter(item => 
        item.status !== 'pending' && item.status !== 'cancelled'
      );

      const validExpenses = (expensesData || []).filter(e => 
        e.status === 'paid' || !e.status
      );

      const validFinMovs = (finMovsData || []).filter(m => 
        m.status !== 'pending'
      );

      // --- CALCULATIONS ---

      // A. Sales & Revenue
      const totalRevenue = validSales.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0);
      const totalNetProfit = validSaleItems.reduce((acc, item) => acc + (parseFloat(item.net_profit) || 0), 0);
      const salesCount = validSales.length;
      const averageTicket = salesCount > 0 ? (totalRevenue / salesCount) : 0;
      const profitMarginPercentage = totalRevenue > 0 ? (totalNetProfit / totalRevenue) : 0;

      // B. Payment Method Breakdown & Net Funds
      const salesByPaymentMethod = {};
      validSales.forEach(s => {
        const method = s.payment_method || 'Otros';
        const amt = parseFloat(s.total_amount) || 0;
        salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + amt;
      });

      let salesCash = salesByPaymentMethod['Efectivo'] || 0;
      let salesTransfer = totalRevenue - salesCash;

      let expensesCash = 0;
      let expensesTransfer = 0;
      validExpenses.forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        if (e.paid_from_register) {
          expensesCash += amt;
        } else {
          expensesTransfer += amt;
        }
      });

      let withdrawalsCash = 0;
      let withdrawalsTransfer = 0;
      let investmentsCash = 0;
      let investmentsTransfer = 0;

      validFinMovs.forEach(m => {
        const amt = parseFloat(m.amount) || 0;
        if (m.type === 'withdrawal') {
          if (m.payment_method === 'Efectivo') withdrawalsCash += amt;
          else withdrawalsTransfer += amt;
        } else if (m.type === 'investment' && !m.related_id) {
          if (m.payment_method === 'Efectivo') investmentsCash += amt;
          else investmentsTransfer += amt;
        }
      });

      const netCashBalance = salesCash - expensesCash + withdrawalsCash + investmentsCash;
      const netTransferBalance = salesTransfer - expensesTransfer + withdrawalsTransfer + investmentsTransfer;

      // C. Expenses Breakdown
      const totalExpenses = validExpenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
      const expensesByCategory = {};
      validExpenses.forEach(exp => {
        const catName = exp.expense_categories?.name || 'General';
        const amt = parseFloat(exp.amount) || 0;
        expensesByCategory[catName] = (expensesByCategory[catName] || 0) + amt;
      });

      let breakEvenPoint = 0;
      if (profitMarginPercentage > 0) {
        breakEvenPoint = totalExpenses / profitMarginPercentage;
      }

      // D. Mercadería Valuation
      let totalInventoryCost = 0;
      let totalInventorySaleValue = 0;
      const partnerInvestments = {};

      (lots || []).forEach(lot => {
        const partnerName = lot.partners?.name || 'Desconocido';
        const qty = lot.quantity || 0;
        const cost = parseFloat(lot.cost_price || 0);
        const salePrice = parseFloat(lot.products?.sale_price || 0);

        const investmentCost = qty * cost;
        const potentialSale = qty * salePrice;

        totalInventoryCost += investmentCost;
        totalInventorySaleValue += potentialSale;

        partnerInvestments[partnerName] = (partnerInvestments[partnerName] || 0) + investmentCost;
      });

      // E. Product Performance
      const productPerformance = {};
      validSaleItems.forEach(item => {
        if (!productPerformance[item.product_name]) {
          productPerformance[item.product_name] = { quantity: 0, profit: 0 };
        }
        productPerformance[item.product_name].quantity += item.sold_quantity;
        productPerformance[item.product_name].profit += parseFloat(item.net_profit || 0);
      });
      
      const topProductsByQuantity = Object.entries(productPerformance)
        .map(([name, data]) => ({ name, quantity: data.quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const topProductsByProfit = Object.entries(productPerformance)
        .map(([name, data]) => ({ name, profit: data.profit }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

      // F. Projections
      const averageDailySales = totalRevenue / Math.max(1, daysPassed);
      const projectedSales = isCurrentMonth ? averageDailySales * 24 : totalRevenue;
      const projectedMargin = projectedSales * profitMarginPercentage;

      // G. Technical Services Income
      const technicalServices = { total: 0, byPartner: {} };
      (techServicesData || []).forEach(ts => {
        const partnerName = ts.partners?.name || 'Desconocido';
        const amt = parseFloat(ts.amount || 0);
        technicalServices.total += amt;
        technicalServices.byPartner[partnerName] = (technicalServices.byPartner[partnerName] || 0) + amt;
      });

      // H. Purchases per Partner (Period)
      const periodPurchasesTotal = { total: 0, byPartner: {} };
      (periodPurchases || []).forEach(p => {
        const partnerName = p.partners?.name || 'Desconocido';
        const amt = parseFloat(p.total_amount || 0);
        periodPurchasesTotal.total += amt;
        periodPurchasesTotal.byPartner[partnerName] = (periodPurchasesTotal.byPartner[partnerName] || 0) + amt;
      });

      // Period Label
      const nowObj = new Date();
      let periodLabel = 'Este Mes';
      if (period === 'day') periodLabel = 'Hoy';
      else if (period === 'week') periodLabel = 'Esta Semana';
      else if (period === 'month') periodLabel = `${MONTH_NAMES[nowObj.getMonth()]} ${nowObj.getFullYear()}`;
      else if (period.includes('-')) {
        const [y, m] = period.split('-').map(Number);
        periodLabel = `${MONTH_NAMES[m - 1]} ${y}`;
      }

      setStats({
        periodLabel,
        totalRevenue,
        totalNetProfit,
        salesCount,
        averageTicket,
        profitMarginPercentage,
        salesByPaymentMethod,
        salesCash,
        salesTransfer,
        netCashBalance,
        netTransferBalance,
        totalExpenses,
        expensesCash,
        expensesTransfer,
        expensesByCategory,
        breakEvenPoint,
        totalInventoryCost,
        totalInventorySaleValue,
        topProductsByQuantity,
        topProductsByProfit,
        partnerInvestments,
        averageDailySales,
        projectedSales,
        projectedMargin,
        technicalServices,
        periodPurchasesTotal
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refresh: fetchStatistics };
}
