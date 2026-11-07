/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Modal } from './Modal';
import { GoogleSignInButton } from './GoogleSignInButton';
import { googleSignIn } from '../../services/googleAuth';
import { storage } from '../../services/storage';
import { DRIVE_DATABASE_FILENAME } from '../../services/googleDriveService';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  Cloud,
  Building2,
  Home,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Copy,
  ExternalLink,
  Check,
} from 'lucide-react';

interface GoogleAuthStartupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export const GoogleAuthStartupModal: React.FC<GoogleAuthStartupModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setUnauthorizedDomain(null);
    try {
      const { user, accessToken } = await googleSignIn();
      // Conecta ao Google Drive e baixa a base mais recente
      await storage.connectGoogleDrive(accessToken, user, 'PULL_FIRST');
      onSyncComplete();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('auth/unauthorized-domain') || err?.message?.includes('não está autorizado')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomain(host);
        setErrorMsg(
          `O domínio "${host}" não está na lista de domínios autorizados do Firebase Authentication do projeto ${firebaseConfig.projectId}.`
        );
      } else {
        console.error('Falha ao autenticar com Google Drive:', err);
        setErrorMsg(
          err?.message === 'Falha ao obter token de acesso do Google Drive.'
            ? 'Autorização não concluída. Por favor, tente novamente.'
            : err?.message || 'Erro ao conectar conta Google.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDomain = () => {
    if (unauthorizedDomain) {
      navigator.clipboard.writeText(unauthorizedDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sincronização em Nuvem - Gráfica Marreco" maxWidth="md">
      <div className="space-y-5">
        {/* Banner visual com ícone de nuvem e Google Drive */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl border border-slate-700/80 shadow-xs">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-11 h-11 rounded-lg bg-[#01B8AA]/20 border border-[#01B8AA] flex items-center justify-center text-[#01B8AA] shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Persistência Direta no Google Drive</h3>
              <p className="text-xs text-slate-300">
                Acesse seus orçamentos e apontamentos em qualquer computador
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-2 pt-3 border-t border-slate-700/60 leading-relaxed">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#01B8AA] shrink-0" />
              <span>
                <strong>No trabalho:</strong> orce produtos e registre apontamentos de chão de fábrica.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Em casa:</strong> abra o sistema e continue de onde parou automaticamente.
              </span>
            </div>
          </div>
        </div>

        {/* Informação sobre o arquivo */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <ShieldCheck className="w-4 h-4 text-[#01B8AA]" />
            <span>Seguro e sob o seu controle</span>
          </div>
          <p>
            O banco de dados é salvo como <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 font-semibold text-slate-900">{DRIVE_DATABASE_FILENAME}</code> dentro da sua própria conta do Google Drive.
          </p>
        </div>

        {/* Alerta detalhado se o domínio não estiver autorizado no Firebase */}
        {unauthorizedDomain && (
          <div className="p-4 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">
                  Domínio não autorizado no Firebase Console
                </p>
                <p className="text-amber-800 mt-1">
                  O Firebase Authentication exige que o domínio do aplicativo esteja na lista de domínios autorizados para habilitar login via popup Google.
                </p>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Domínio a autorizar:</span>
                <code className="text-xs font-mono font-bold text-gray-900 truncate block">
                  {unauthorizedDomain}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
              <a
                href={firebaseConsoleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#01B8AA] hover:text-[#009E91] font-bold underline"
              >
                <span>Abrir Firebase Console &gt; Authorized Domains</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Outras mensagens de erro */}
        {errorMsg && !unauthorizedDomain && (
          <div className="p-3 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Botão Oficial de Login e Botão de Continuar Localmente */}
        <div className="space-y-2.5 pt-2">
          <GoogleSignInButton
            onClick={handleSignIn}
            loading={loading}
            className="w-full justify-center py-3 text-sm font-semibold"
            label="Conectar e Sincronizar com Google Drive"
          />

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-2.5 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-center"
          >
            Continuar com armazenamento local (IndexedDB)
          </button>
        </div>
      </div>
    </Modal>
  );
};
