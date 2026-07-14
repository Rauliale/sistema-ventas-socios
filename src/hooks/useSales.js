import { useState } from 'react';
import { db } from '../lib/supabase';

export function useSales() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSale = async (sellerId, customerId, paymentMethod, items) => {
    try {
      setLoading(true);
      setError(null);
      // RPC process_sale expects items as a JSON array of objects
      const saleId = await db.call('rpc_process_sale', {
        p_seller_id: sellerId,
        p_customer_id: customerId,
        p_payment_method: paymentMethod,
        p_items: items // [{product_id, quantity, unit_price}]
      });

      // Automatic 4% tax deduction for non-cash payments
      if (paymentMethod !== 'Efectivo') {
        const totalAmount = items.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.unit_price)), 0);
        const taxAmount = totalAmount * 0.04;

        if (taxAmount > 0) {
          const { supabase } = await import('../lib/supabase');
          
          // 1. Get or create category
          let { data: catData } = await supabase
            .from('expense_categories')
            .select('id')
            .eq('name', 'Impuestos Provinciales')
            .single();
            
          let catId;
          if (!catData) {
            const { data: newCat } = await supabase
              .from('expense_categories')
              .insert({ name: 'Impuestos Provinciales', description: 'Retenciones automáticas de pagos' })
              .select()
              .single();
            catId = newCat.id;
          } else {
            catId = catData.id;
          }

          // 2. Get sale number for description
          const { data: saleData } = await supabase
            .from('sales')
            .select('sale_number')
            .eq('id', saleId)
            .single();

          const desc = saleData 
            ? `Retención Impuesto (4%) - Venta #${saleData.sale_number}`
            : `Retención Impuesto (4%) - Venta Digital`;

          // 3. Insert Expense
          const expData = await db.insert('expenses', {
            category_id: catId,
            description: desc,
            amount: taxAmount,
            shared_type: '33_all',
            paid_from_register: false,
            status: 'paid'
          });

          // 4. Financial movements (33_all distribution)
          const partners = await db.get('partners');
          const raul = partners.find(p => p.name === 'Raúl');
          const nahuel = partners.find(p => p.name === 'Nahuel');
          const negro = partners.find(p => p.name === 'Negro Añais');

          let financialMovements = [];
          const split = taxAmount / 3;
          if (raul) financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -split, related_id: expData[0].id, payment_method: 'Transferencia' });
          if (nahuel) financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -split, related_id: expData[0].id, payment_method: 'Transferencia' });
          if (negro) financialMovements.push({ partner_id: negro.id, type: 'expense', amount: -split, related_id: expData[0].id, payment_method: 'Transferencia' });
          
          if (financialMovements.length > 0) {
            await db.insert('financial_movements', financialMovements);
          }
        }
      }

      return saleId;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSalePaymentMethod = async (saleId, newPaymentMethod) => {
    try {
      setLoading(true);
      setError(null);
      const { supabase } = await import('../lib/supabase');

      // 1. Fetch current sale data
      const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('payment_method, total_amount, sale_number')
        .eq('id', saleId)
        .single();

      if (saleErr) throw saleErr;

      const oldPaymentMethod = sale.payment_method;
      if (oldPaymentMethod === newPaymentMethod) return;

      // 2. Update payment method on sales table
      const { error: updateErr } = await supabase
        .from('sales')
        .update({ payment_method: newPaymentMethod })
        .eq('id', saleId);

      if (updateErr) throw updateErr;

      const desc = `Retención Impuesto (4%) - Venta #${sale.sale_number}`;

      // 3. Handle side-effects: Tax deduction (4% Provincial Tax)
      const oldIsCash = oldPaymentMethod === 'Efectivo';
      const newIsCash = newPaymentMethod === 'Efectivo';

      if (oldIsCash && !newIsCash) {
        // Transition from Cash to Digital -> Create tax expense and splits
        const totalAmount = parseFloat(sale.total_amount);
        const taxAmount = totalAmount * 0.04;

        if (taxAmount > 0) {
          // Get or create category
          let { data: catData } = await supabase
            .from('expense_categories')
            .select('id')
            .eq('name', 'Impuestos Provinciales')
            .single();
            
          let catId;
          if (!catData) {
            const { data: newCat } = await supabase
              .from('expense_categories')
              .insert({ name: 'Impuestos Provinciales', description: 'Retenciones automáticas de pagos' })
              .select()
              .single();
            catId = newCat.id;
          } else {
            catId = catData.id;
          }

          // Insert Expense
          const { data: newExp, error: expErr } = await supabase
            .from('expenses')
            .insert({
              category_id: catId,
              description: desc,
              amount: taxAmount,
              shared_type: '33_all',
              paid_from_register: false,
              status: 'paid'
            })
            .select()
            .single();

          if (expErr) throw expErr;

          // Financial movements (33_all distribution)
          const partners = await db.get('partners');
          const raul = partners.find(p => p.name === 'Raúl');
          const nahuel = partners.find(p => p.name === 'Nahuel');
          const negro = partners.find(p => p.name === 'Negro Añais');

          let financialMovements = [];
          const split = taxAmount / 3;
          if (raul) financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -split, related_id: newExp.id, payment_method: 'Transferencia' });
          if (nahuel) financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -split, related_id: newExp.id, payment_method: 'Transferencia' });
          if (negro) financialMovements.push({ partner_id: negro.id, type: 'expense', amount: -split, related_id: newExp.id, payment_method: 'Transferencia' });
          
          if (financialMovements.length > 0) {
            const { error: finErr } = await supabase
              .from('financial_movements')
              .insert(financialMovements);
            if (finErr) throw finErr;
          }
        }
      } else if (!oldIsCash && newIsCash) {
        // Transition from Digital to Cash -> Delete tax expense and splits
        const { data: existingExp } = await supabase
          .from('expenses')
          .select('id')
          .eq('description', desc)
          .maybeSingle();

        if (existingExp) {
          // Delete financial movements
          const { error: delFinErr } = await supabase
            .from('financial_movements')
            .delete()
            .eq('related_id', existingExp.id);
          if (delFinErr) throw delFinErr;

          // Delete expense
          const { error: delExpErr } = await supabase
            .from('expenses')
            .delete()
            .eq('id', existingExp.id);
          if (delExpErr) throw delExpErr;
        }
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelSale = async (saleId, reason) => {
    try {
      setLoading(true);
      setError(null);
      const { supabase } = await import('../lib/supabase');
      const { error: err } = await supabase.rpc('rpc_cancel_sale', {
        p_sale_id: saleId,
        p_reason: reason
      });
      if (err) throw err;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    processSale,
    updateSalePaymentMethod,
    cancelSale,
    loading,
    error
  };
}

