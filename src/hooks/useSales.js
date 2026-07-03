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

  return {
    processSale,
    loading,
    error
  };
}
