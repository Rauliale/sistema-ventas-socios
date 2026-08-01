import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

      const now = new Date();
      let startLocal;
      let endLocal;
      let isCurrentMonth = false;
      let totalDaysInMonth = 30;

      if (period === 'day') {
        startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (period === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startLocal = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        endLocal = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
      } else if (period === 'month') {
        isCurrentMonth = true;
        startLocal = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endLocal = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      } else if (period.includes('-')) {
        const [y, m] = period.split('-').map(Number);
        const currentY = now.getFullYear();
        const currentM = now.getMonth() + 1;
        isCurrentMonth = (y === currentY && m === currentM);
        startLocal = new Date(y, m - 1, 1, 0, 0, 0, 0);
        endLocal = new Date(y, m, 0, 23, 59, 59, 999);
        totalDaysInMonth = new Date(y, m, 0).getDate();
      } else {
        isCurrentMonth = true;
        startLocal = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endLocal = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      }

      let isoStart = startLocal.toISOString();
      let isoEnd = endLocal.toISOString();

      if (isoStart < '2026-07-01T00:00:00.000Z') {
        isoStart = '2026-07-01T00:00:00.000Z';
      }

      // 1. Fetch Sales Items from view (paid sales only)
      const { data: saleItems, error: salesErr } = await supabase
        .from('vw_sales_details')
        .select('*')
        .gte('sale_date', isoStart)
        .lte('sale_date', isoEnd)
        .eq('status', 'paid');
        
      if (salesErr) throw salesErr;

      // 2. Fetch Unique Sales with payment_method
      const { data: uniqueSales, error: uniqErr } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method, date')
        .gte('date', isoStart)
        .lte('date', isoEnd)
        .eq('status', 'paid');

      if (uniqErr) throw uniqErr;

      // 3. Fetch Expenses
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('amount, paid_from_register, status, category_id, date, expense_categories(name)')
        .gte('date', isoStart)
        .lte('date', isoEnd)
        .eq('status', 'paid');

      if (expErr) throw expErr;

      // 4. Fetch All Active Product Lots for Mercadería / Stock Valuation
      const { data: lots, error: lotsErr } = await supabase
        .from('product_lots')
        .select('quantity, cost_price, partner_id, partners(name), products(sale_price)')
        .gt('quantity', 0);

      if (lotsErr) throw lotsErr;

      // 5. Fetch Financial Movements for Cash/Transfer net calculation in period
      const { data: finMovs, error: finErr } = await supabase
        .from('financial_movements')
        .select('*')
        .gte('date', isoStart)
        .lte('date', isoEnd)
        .eq('status', 'paid');

      if (finErr) throw finErr;

      // --- CALCULATIONS ---

      // A. Sales & Revenue
      const totalRevenue = saleItems.reduce((acc, item) => acc + (parseFloat(item.total_revenue) || 0), 0);
      const totalNetProfit = saleItems.reduce((acc, item) => acc + (parseFloat(item.net_profit) || 0), 0);
      const salesCount = uniqueSales.length;
      const averageTicket = salesCount > 0 ? (totalRevenue / salesCount) : 0;
      const profitMarginPercentage = totalRevenue > 0 ? (totalNetProfit / totalRevenue) : 0;

      // B. Payment Method Breakdown & Net Funds
      const salesByPaymentMethod = {};
      uniqueSales.forEach(s => {
        const method = s.payment_method || 'Otros';
        const amt = parseFloat(s.total_amount) || 0;
        salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + amt;
      });

      let salesCash = salesByPaymentMethod['Efectivo'] || 0;
      let salesTransfer = totalRevenue - salesCash;

      let expensesCash = 0;
      let expensesTransfer = 0;
      expenses.forEach(e => {
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

      (finMovs || []).forEach(m => {
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
      const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
      const expensesByCategory = {};
      expenses.forEach(exp => {
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

      lots.forEach(lot => {
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
      saleItems.forEach(item => {
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
      let daysPassed = 1;
      if (period === 'day') {
        daysPassed = 1;
      } else if (period === 'week') {
        daysPassed = Math.min(now.getDay() || 7, 7);
      } else if (isCurrentMonth) {
        daysPassed = Math.max(1, now.getDate());
      } else {
        daysPassed = totalDaysInMonth;
      }

      const averageDailySales = totalRevenue / Math.max(1, daysPassed);
      const projectedSales = isCurrentMonth ? averageDailySales * 24 : totalRevenue;
      const projectedMargin = projectedSales * profitMarginPercentage;

      // Period Label
      let periodLabel = 'Este Mes';
      if (period === 'day') periodLabel = 'Hoy';
      else if (period === 'week') periodLabel = 'Esta Semana';
      else if (period === 'month') periodLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
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
        projectedMargin
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refresh: fetchStatistics };
}
