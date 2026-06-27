import React from 'react';
import styles from './Button.module.css';
import { Loader2 } from 'lucide-react';

export function Button({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  disabled = false, 
  onClick, 
  type = 'button',
  className = ''
}) {
  const baseClass = `${styles.button} ${styles[variant]} ${className}`;

  return (
    <button 
      className={baseClass} 
      onClick={onClick} 
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading && <Loader2 className={styles.loadingIcon} size={16} />}
      {children}
    </button>
  );
}
