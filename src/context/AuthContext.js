'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const session = await auth.getSession();
        if (session && mounted) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Protection logic
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  const fetchProfile = async (userId) => {
    try {
      // Get role and name from profiles table
      const p = await db.getOne('profiles', userId);
      setProfile(p);
    } catch (err) {
      console.warn('No profile found or error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    await auth.signIn(email, password);
  };

  const logout = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
