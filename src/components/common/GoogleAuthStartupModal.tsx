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
import { Cloud, Building2, Home, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

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

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { user, accessToken } = await googleSignIn();
      // Conecta ao Google Drive e baixa a base mais recente
      await storage.connectGoogleDrive(accessToken, user, 'PULL_FIRST');
      onSyncComplete();
      onClose();
    } catch (err: any) {
      console.error('Falha ao autenticar com Google Drive:', err);
      setErrorMsg(
        err?.message === 'Falha ao obter token de acesso do Google Drive.'
          ? 'Autorização não concluída. Por favor, tente novamente.'
          : err?.message || 'Erro ao conectar conta Google.'
      );
    } finally {
      setLoading(false);
    }
  };

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

        {/* Mensagem de Erro se houver */}
        {errorMsg && (
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
            className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Continuar apenas com armazenamento local deste navegador
          </button>
        </div>
      </div>
    </Modal>
  );
};
