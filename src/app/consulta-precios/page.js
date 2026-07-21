'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProducts } from '../../hooks/useProducts';

export default function ConsultaPrecios() {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts([]);
      return;
    }

    const lowerSearch = searchTerm.toLowerCase();
    const filtered = products.filter(p => 
      (p.name && p.name.toLowerCase().includes(lowerSearch)) ||
      (p.barcode && p.barcode.toLowerCase().includes(lowerSearch)) ||
      (p.sku && p.sku.toLowerCase().includes(lowerSearch))
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '1rem',
      backgroundColor: 'var(--color-background)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--color-text)' }}>🔍 Consulta</h1>
        <Link href="/" style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
          color: 'var(--color-text)',
          fontWeight: 'bold',
          fontSize: '1rem'
        }}>
          Volver
        </Link>
      </header>

      {/* Search Input */}
      <div style={{ marginBottom: '2rem' }}>
        <input 
          type="text" 
          placeholder="🔎 Buscar por nombre o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-primary)',
            outline: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        />
      </div>

      {/* Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>Cargando productos...</p>}
        
        {!loading && searchTerm.trim() !== '' && filteredProducts.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            fontSize: '1.2rem'
          }}>
            No se encontraron resultados
          </div>
        )}

        {filteredProducts.map(product => (
          <div key={product.id} style={{
            backgroundColor: 'var(--color-surface)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1.5rem', 
              color: 'var(--color-text)'
            }}>
              {product.name}
            </h2>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: '1rem'
            }}>
              <div>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Stock: {product.stock} {product.stockBreakdown}</span>
                {product.barcode && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Cód: {product.barcode}</div>}
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: '900',
                color: 'var(--color-primary)',
                lineHeight: '1'
              }}>
                ${parseFloat(product.sale_price).toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        ))}
        
        {!searchTerm && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--color-text-secondary)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
            <p style={{ fontSize: '1.2rem' }}>Usa el buscador arriba para consultar precios rápidamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
