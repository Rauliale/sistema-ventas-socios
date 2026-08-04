'use client';

import React from 'react';
import { Button } from './ui/Button';
import { Printer, X } from 'lucide-react';
import styles from './TicketA4Modal.module.css';

export function TicketA4Modal({ sale, onClose }) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
  };

  const isPending = sale.status === 'pending';
  const customerName = sale.clientes?.name || sale.customer_name || 'Consumidor Final';
  const sellerName = sale.profiles?.name || sale.seller_name || 'InfoNeg';

  const rawItems = sale.items || sale.sale_items || [];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* Actions bar (hidden during print) */}
        <div className={styles.actionsBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={20} />
            <strong style={{ fontSize: '1.1rem' }}>Comprobante Venta #{sale.sale_number}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="primary" onClick={handlePrint}>
              <Printer size={16} style={{ marginRight: '6px' }} />
              Imprimir Hoja A4
            </Button>
            <Button variant="secondary" onClick={onClose}>
              <X size={16} style={{ marginRight: '4px' }} />
              Cerrar
            </Button>
          </div>
        </div>

        {/* Printable A4 Container */}
        <div id="printable-a4-ticket" className={styles.a4Page}>
          <div className={styles.header}>
            <div className={styles.brandInfo}>
              <h1 className={styles.brandTitle}>Gestión InfoNeg</h1>
              <p className={styles.brandSubtitle}>Comprobante de Venta</p>
            </div>
            <div className={styles.invoiceMeta}>
              <div className={styles.saleBadge}>Venta #{sale.sale_number}</div>
              <div className={styles.metaRow}>
                <span>Fecha:</span>
                <strong>{new Date(sale.date).toLocaleString('es-AR')}</strong>
              </div>
              <div className={styles.metaRow}>
                <span>Vendedor:</span>
                <strong>{sellerName}</strong>
              </div>
            </div>
          </div>

          <div className={styles.clientSection}>
            <div className={styles.clientBox}>
              <span className={styles.boxTitle}>DATOS DEL CLIENTE</span>
              <div className={styles.clientName}>{customerName}</div>
              {sale.clientes?.phone && <div style={{ fontSize: '13px', marginTop: '4px', color: '#475569' }}>Tel: {sale.clientes.phone}</div>}
            </div>

            <div className={styles.paymentBox}>
              <span className={styles.boxTitle}>CONDICIONES DE PAGO</span>
              <div className={styles.paymentMethod}>
                Forma de Pago: <strong>{sale.payment_method}</strong>
              </div>
              <div className={styles.paymentStatus}>
                Estado: <span className={isPending ? styles.statusPending : styles.statusPaid}>
                  {isPending ? 'PENDIENTE (Cuenta Corriente)' : 'PAGADO'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Descripción / Producto</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Cant.</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Precio Unit.</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {rawItems.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    Sin detalle de ítems registrado.
                  </td>
                </tr>
              ) : (
                rawItems.map((item, idx) => {
                  const prodName = item.product_name || item.products?.name || item.name || 'Producto';
                  const qty = item.quantity || 1;
                  const unitPrice = parseFloat(item.unit_price || 0);
                  const totalPrice = parseFloat(item.total_price || (qty * unitPrice));

                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td><strong>{prodName}</strong></td>
                      <td style={{ textAlign: 'center' }}>{qty}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(unitPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalPrice)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className={styles.totalsSection}>
            <div className={styles.totalBox}>
              <span>TOTAL DE VENTA</span>
              <div className={styles.totalAmount}>
                {formatCurrency(sale.total_amount)}
              </div>
            </div>
          </div>

          <div className={styles.footerNote}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>¡Muchas gracias por su compra!</p>
            <small style={{ color: '#94a3b8' }}>Documento de uso interno / comprobante no fiscal</small>
          </div>
        </div>
      </div>
    </div>
  );
}
