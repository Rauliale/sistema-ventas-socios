import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase variables are missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Wrapper for Authentication
 */
export const auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    return data?.user || null;
  },
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return data?.session || null;
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

/**
 * Wrapper for database queries to abstract Supabase specifics
 * and provide global error handling.
 */
export const db = {
  async get(table, query = {}) {
    let req = supabase.from(table).select(query.select || '*');
    if (query.eq) {
      for (const [key, val] of Object.entries(query.eq)) {
        req = req.eq(key, val);
      }
    }
    if (query.order) {
      req = req.order(query.order.column, { ascending: query.order.ascending });
    }
    const { data, error } = await req;
    if (error) throw new Error(error.message);
    return data;
  },

  async getOne(table, id) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async insert(table, payload) {
    const { data, error } = await supabase.from(table).insert(payload).select();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(table, id, payload) {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async call(rpcName, payload) {
    const { data, error } = await supabase.rpc(rpcName, payload);
    if (error) throw new Error(error.message);
    return data;
  }
};
