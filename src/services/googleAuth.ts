/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializa Firebase apenas se não houver instância ativa
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.readonly',
];

// Provedor Google com os escopos configurados do Google Drive
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Forçar seleção de conta se necessário
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache do token em memória (RAM) conforme diretrizes de segurança
let cachedAccessToken: string | null = null;
let isSigningIn = false;
type AuthCallback = (user: User | null, token: string | null) => void;
const authListeners: Set<AuthCallback> = new Set();

export const initAuth = (callback?: AuthCallback): (() => void) => {
  if (callback) {
    authListeners.add(callback);
    // Dispara imediatamente com o estado atual
    callback(auth.currentUser, cachedAccessToken);
  }

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      cachedAccessToken = null;
    }
    // Notifica todos os ouvintes
    authListeners.forEach((listener) => {
      try {
        listener(user, cachedAccessToken);
      } catch (e) {
        console.error('Erro em ouvinte de autenticação Google:', e);
      }
    });
  });

  return () => {
    if (callback) authListeners.delete(callback);
    unsubscribe();
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    // Notifica ouvintes sobre a disponibilização do token
    authListeners.forEach((listener) => {
      try {
        listener(result.user, cachedAccessToken);
      } catch (e) {
        console.error('Erro em listener pós-login:', e);
      }
    });

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro no login Google OAuth2:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  authListeners.forEach((listener) => {
    try {
      listener(null, null);
    } catch (e) {
      console.error('Erro em listener pós-logout:', e);
    }
  });
};
