'use client';

import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import styles from './page.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(email, password);
    } catch (err) {
      setErrorMsg('Credenciales inválidas o error de red.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.loginCard}>
        <h2 className={styles.title}>Iniciar Sesión</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <Input 
            label="Correo Electrónico" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            autoFocus
          />
          <Input 
            label="Contraseña" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          {errorMsg && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{errorMsg}</p>}
          
          <Button type="submit" isLoading={isLoading} style={{ marginTop: '1rem' }}>
            Ingresar
          </Button>
        </form>
      </Card>
    </div>
  );
}
