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
        .select('*, product_lots(quantity)')
        .order('name', { ascending: true });
      
      if (fetchErr) throw new Error(fetchErr.message);
      
      // Calculate total stock from lots
      const productsWithStock = data.map(product => {
        const totalStock = product.product_lots?.reduce((sum, lot) => sum + (lot.quantity || 0), 0) || 0;
        return { ...product, stock: totalStock };
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

  return {
    products,
    loading,
    error,
    fetchProducts,
    addProduct,
    updateProduct
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
