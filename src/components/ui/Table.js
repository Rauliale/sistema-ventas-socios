import React from 'react';
import styles from './Table.module.css';

export function Table({ columns, data, emptyMessage = "No hay datos disponibles", className = '' }) {
  return (
    <div className={`${styles.container} ${className}`}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.tr}>
            {columns.map((col, idx) => (
              <th key={idx} className={styles.th}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rowIdx) => (
              <tr key={rowIdx} className={styles.tr}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={styles.td}>
                    {col.render ? col.render(row) : (col.accessor ? row[col.accessor] : null)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
