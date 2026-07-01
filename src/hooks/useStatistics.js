import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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

      // Determine date range based on period
      const now = new Date();
      let startDate = new Date();
      let prevStartDate = new Date();
      let prevEndDate = new Date();

      if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      }

      const isoStart = startDate.toISOString();

      // 1. Fetch Sales Items from view
      const { data: saleItems, error: salesErr } = await supabase
        .from('vw_sales_details')
        .select('*')
        .gte('sale_date', isoStart);
        
      if (salesErr) throw salesErr;

      // 2. Fetch Unique Sales (Tickets) for Average Ticket calculation
      const { data: uniqueSales, error: uniqErr } = await supabase
        .from('sales')
        .select('id, total_amount')
        .gte('date', isoStart);

      if (uniqErr) throw uniqErr;

      // 3. Fetch Expenses for Break-Even
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('amount')
        .gte('created_at', isoStart);

      if (expErr) throw expErr;

      // 4. Fetch Purchases (product_lots) for Partner contributions
      // This is not filtered by date, as the user wants historical total participation.
      const { data: lots, error: lotsErr } = await supabase
        .from('product_lots')
        .select('quantity, cost_price, partners(name)');

      if (lotsErr) throw lotsErr;

      // --- CALCULATIONS ---

      // A. Sales & Revenue
      const totalRevenue = saleItems.reduce((acc, item) => acc + (parseFloat(item.total_revenue) || 0), 0);
      const totalNetProfit = saleItems.reduce((acc, item) => acc + (parseFloat(item.net_profit) || 0), 0);
      const salesCount = uniqueSales.length;
      
      // B. Average Ticket
      const averageTicket = salesCount > 0 ? (totalRevenue / salesCount) : 0;

      // C. Profit Margin (%)
      const profitMarginPercentage = totalRevenue > 0 ? (totalNetProfit / totalRevenue) : 0;

      // D. Expenses & Break-Even
      const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
      
      // Break-Even = Fixed Costs / Profit Margin
      // If margin is 50% (0.5), and expenses $1000 => Break even is $2000 in sales.
      let breakEvenPoint = 0;
      if (profitMarginPercentage > 0) {
        breakEvenPoint = totalExpenses / profitMarginPercentage;
      }

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

      // F. Partner Purchases (Investments)
      const partnerInvestments = {};
      lots.forEach(lot => {
        const partnerName = lot.partners?.name || 'Desconocido';
        const investment = lot.quantity * parseFloat(lot.cost_price || 0);
        partnerInvestments[partnerName] = (partnerInvestments[partnerName] || 0) + investment;
      });

      // G. Projections (24 working days)
      let daysPassed = 1;
      if (period === 'month') {
        daysPassed = now.getDate();
      } else if (period === 'week') {
        daysPassed = now.getDay() || 7; // 1 to 7 (Sunday = 7)
      }
      
      const averageDailySales = totalRevenue / Math.max(1, daysPassed);
      const projectedSales = averageDailySales * 24;
      const projectedMargin = projectedSales * profitMarginPercentage; // Usando porcentaje real

      setStats({
        totalRevenue,
        totalNetProfit,
        salesCount,
        averageTicket,
        profitMarginPercentage,
        totalExpenses,
        breakEvenPoint,
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
