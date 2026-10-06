import { appConfig } from '../config.js';

const STORAGE_KEY = 'devia.auth.session';

function authUrl(path) {
  return appConfig.supabase.url + '/auth/v1/' + path;
}

function apiHeaders(accessToken) {
  return {
    apikey: appConfig.supabase.publishableKey,
    Authorization: 'Bearer ' + (accessToken || appConfig.supabase.publishableKey),
    'Content-Type': 'application/json',
  };
}

async function request(path, options = {}) {
  const response = await fetch(authUrl(path), {
    ...options,
    headers: { ...apiHeaders(options.accessToken), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.msg || body.message || 'Não foi possível comunicar com o Supabase Auth.');
  return body;
}

function saveSession(session) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  return session;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getUser() {
  return getSession()?.user || null;
}

export async function signUp({ email, password, fullName }) {
  const redirectTo = window.location.origin + '/login?confirmed=1';
  const data = await request('signup?redirect_to=' + encodeURIComponent(redirectTo), {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { full_name: fullName } }),
  });
  if (data.session) saveSession(data.session);
  return data;
}

export async function signIn({ email, password }) {
  const data = await request('token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveSession(data);
  return data;
}

export async function signOut() {
  const session = getSession();
  try {
    if (session?.access_token) {
      await request('logout', { method: 'POST', accessToken: session.access_token });
    }
  } finally {
    saveSession(null);
  }
}

export async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) return null;
  try {
    const data = await request('token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    saveSession(data);
    return data;
  } catch {
    saveSession(null);
    return null;
  }
}

async function dataApi(path, options = {}) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Sessão não encontrada.');

  const headers = {
    apikey: appConfig.supabase.publishableKey,
    Authorization: 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.method === 'POST') headers.Prefer = 'return=representation';

  const response = await fetch(appConfig.supabase.url + '/rest/v1/' + path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.hint || body.details || 'Não foi possível acessar os dados do workspace.');
  return body;
}

export async function createInitialWorkspace(fullName = '') {
  const user = getUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const existing = await dataApi(
    'workspaces?select=id,name,slug&owner_id=eq.' + encodeURIComponent(user.id) + '&limit=1'
  );
  if (existing.length) return existing[0];

  const baseName = (fullName || user.email?.split('@')[0] || 'Meu workspace').trim();
  const safeSlug = baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'workspace';

  const created = await dataApi('workspaces', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: user.id,
      name: baseName.slice(0, 80),
      slug: safeSlug + '-' + user.id.slice(0, 8),
    }),
  });
  return created[0];
}
