import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');
      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*, product_lots(id, quantity, partner_id, cost_price, created_at, partners(name))')
        .order('name', { ascending: true });
      
      if (fetchErr) throw new Error(fetchErr.message);
      
      // Calculate total stock and breakdown from lots
      const productsWithStock = data.map(product => {
        const totalStock = product.product_lots?.reduce((sum, lot) => sum + (lot.quantity || 0), 0) || 0;
        
        // Build breakdown string
        const breakdown = {};
        product.product_lots?.forEach(lot => {
          if (lot.quantity > 0) {
            const partnerName = lot.partners?.name || 'Desconocido';
            breakdown[partnerName] = (breakdown[partnerName] || 0) + lot.quantity;
          }
        });
        
        let stockBreakdownText = '';
        const breakdownEntries = Object.entries(breakdown);
        if (breakdownEntries.length > 0) {
          const parts = breakdownEntries.map(([name, qty]) => `${qty} ${name}`);
          stockBreakdownText = ` (${parts.join(', ')})`;
        }

        return { ...product, stock: totalStock, stockBreakdown: stockBreakdownText };
      });
      
      setProducts(productsWithStock);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addProduct = async (payload) => {
    try {
      const data = await db.insert('products', payload);
      setProducts(prev => [...prev, ...data]);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProduct = async (id, payload) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) throw new Error(error.message);
      
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const rectifyProductStock = async (productId, { targetStock, partnerId, reason, costPrice }) => {
    const parsedTarget = parseInt(targetStock, 10);
    if (Number.isNaN(parsedTarget) || parsedTarget < 0) {
      throw new Error('El stock real debe ser un número entero mayor o igual a 0.');
    }

    try {
      const { supabase } = await import('../lib/supabase');
      const { data: currentLots, error: lotsErr } = await supabase
        .from('product_lots')
        .select('id, partner_id, quantity, cost_price, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (lotsErr) throw new Error(lotsErr.message);

      const currentTotalStock = (currentLots || []).reduce(
        (sum, lot) => sum + (Number(lot.quantity) || 0),
        0
      );
      const delta = parsedTarget - currentTotalStock;

      if (delta === 0) {
        return;
      }

      const formattedReason = reason?.trim()
        ? `Rectificación: ${reason.trim()}`
        : 'Rectificación manual de stock';

      if (delta < 0) {
        let remainingToDeduct = Math.abs(delta);
        const activeLots = (currentLots || []).filter(lot => (Number(lot.quantity) || 0) > 0);

        const prioritizedLots = partnerId
          ? [
              ...activeLots.filter(lot => lot.partner_id === partnerId),
              ...activeLots.filter(lot => lot.partner_id !== partnerId)
            ]
          : activeLots;

        for (const lot of prioritizedLots) {
          if (remainingToDeduct <= 0) break;

          const deductQty = Math.min(remainingToDeduct, Number(lot.quantity));
          const newLotQty = Number(lot.quantity) - deductQty;

          const { error: updateLotErr } = await supabase
            .from('product_lots')
            .update({ quantity: newLotQty })
            .eq('id', lot.id);

          if (updateLotErr) throw new Error(updateLotErr.message);

          const { error: movErr } = await supabase
            .from('inventory_movements')
            .insert({
              product_id: productId,
              lot_id: lot.id,
              partner_id: lot.partner_id,
              type: 'OUT',
              quantity: deductQty,
              reason: formattedReason
            });

          if (movErr) throw new Error(movErr.message);

          remainingToDeduct -= deductQty;
        }
      } else {
        let resolvedPartnerId = partnerId || currentLots?.[currentLots.length - 1]?.partner_id;

        if (!resolvedPartnerId) {
          const { data: partnersData, error: partnerErr } = await supabase
            .from('partners')
            .select('id')
            .limit(1)
            .single();

          if (partnerErr || !partnersData?.id) {
            throw new Error('No se encontró un socio para asignar el stock.');
          }
          resolvedPartnerId = partnersData.id;
        }

        const { data: createdLot, error: createLotErr } = await supabase
          .from('product_lots')
          .insert({
            product_id: productId,
            partner_id: resolvedPartnerId,
            quantity: delta,
            cost_price: parseFloat(costPrice) || 0
          })
          .select()
          .single();

        if (createLotErr) throw new Error(createLotErr.message);

        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert({
            product_id: productId,
            lot_id: createdLot.id,
            partner_id: resolvedPartnerId,
            type: 'IN',
            quantity: delta,
            reason: formattedReason
          });

        if (movErr) throw new Error(movErr.message);
      }

      await fetchProducts();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    rectifyProductStock
  };
}

export function useProductLots(productId) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    
    const fetchLots = async () => {
      try {
        setLoading(true);
        // Assuming we join partners table to get the partner name
        // The wrapper doesn't do joins out of the box, let's use supabase directly for joins
        const { supabase } = await import('../lib/supabase');
        const { data, error: fetchErr } = await supabase
          .from('product_lots')
          .select('*, partners(name)')
          .eq('product_id', productId);
          
        if (fetchErr) throw new Error(fetchErr.message);
        setLots(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLots();
  }, [productId]);

  return { lots, loading, error };
}
