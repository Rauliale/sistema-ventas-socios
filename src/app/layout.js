'use client';

import './globals.css';
import Link from 'next/link';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </body>
    </html>
  );
}

function AppContent({ children }) {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  
  if (pathname === '/login' || pathname === '/consulta-precios') {
    return <main>{children}</main>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ 
        width: '250px', 
        backgroundColor: 'var(--color-surface)', 
        borderRight: '1px solid var(--color-border)',
        padding: 'var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h2 style={{ color: 'var(--color-primary)' }}>Gestión InfoNeg</h2>
        
        {profile && (
          <div style={{ margin: '1rem 0', padding: '0.5rem', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
            <strong>{profile.name}</strong><br/>
            <small style={{color: 'var(--color-text-secondary)'}}>{profile.role}</small>
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', flex: 1 }}>
          <Link href="/">📊 Dashboard</Link>
          <Link href="/pos">🛒 Punto de Venta</Link>
          <Link href="/consulta-precios">🔍 Consulta de Precios</Link>
          <Link href="/compras">📦 Compras</Link>
          <Link href="/productos">📋 Productos</Link>
          <Link href="/gastos">💸 Gastos</Link>
          <Link href="/finanzas">📈 Finanzas</Link>
          <Link href="/reportes-ventas">📉 Reportes Ventas</Link>
          <Link href="/estadisticas">🚀 Estadísticas BI</Link>
        </nav>

        <button 
          onClick={logout} 
          style={{
            background: 'transparent', 
            border: 'none', 
            color: 'var(--color-danger)', 
            cursor: 'pointer', 
            textAlign: 'left',
            padding: '0.5rem 0'
          }}
        >
          Cerrar Sesión
        </button>
      </aside>
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
