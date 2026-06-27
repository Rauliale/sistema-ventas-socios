import React from 'react';
import styles from './Card.module.css';

export function Card({ children, title, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </div>
  );
}
