/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { storage } from '../../services/storage';
import { DRIVE_DATABASE_FILENAME } from '../../services/googleDriveService';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  LogOut,
  AlertCircle,
  FileCode,
  ShieldCheck,
  Building2,
  Home,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados dos diálogos de confirmação de segurança (operações destrutivas / substituição)
  const [confirmPushOpen, setConfirmPushOpen] = useState(false);
  const [confirmPullOpen, setConfirmPullOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const driveInfo = storage.getDriveDetails();

  const handleManualSync = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await storage.forcePushToDrive();
      setFeedback({ type: 'success', message: 'Sincronização com o Google Drive concluída com sucesso!' });
      onDataChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao sincronizar com Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPush = async () => {
    setConfirmPushOpen(false);
    setLoading(true);
    setFeedback(null);
    try {
      await storage.forcePushToDrive();
      setFeedback({
        type: 'success',
        message: 'Arquivo dados_grafica_database.json atualizado no Google Drive com os dados deste dispositivo!',
      });
      onDataChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao enviar para o Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPull = async () => {
    setConfirmPullOpen(false);
    setLoading(true);
    setFeedback(null);
    try {
      await storage.forcePullFromDrive();
      setFeedback({
        type: 'success',
        message: 'Dados mais recentes do Google Drive restaurados e aplicados com sucesso!',
      });
      onDataChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao baixar do Google Drive.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setConfirmDisconnectOpen(false);
    try {
      await storage.disconnectGoogleDrive();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Nunca sincronizado nesta sessão';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Sincronização com Google Drive" maxWidth="lg">
        <div className="space-y-6">
          {/* Cabeçalho do Card com Status de Conexão */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {driveInfo.userPhoto ? (
                  <img
                    src={driveInfo.userPhoto}
                    alt={driveInfo.userName || 'Usuário'}
                    className="w-12 h-12 rounded-full border-2 border-[#01B8AA] shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#01B8AA]/20 border border-[#01B8AA] flex items-center justify-center text-[#01B8AA]">
                    <Cloud className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">
                      {driveInfo.userName || 'Conta Google Conectada'}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Conectado
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono">{driveInfo.userEmail}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmDisconnectOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg border border-rose-800/60 transition-colors"
                title="Desconectar conta Google"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar</span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <FileCode className="w-4 h-4 text-[#01B8AA] shrink-0" />
                <span className="truncate">
                  Arquivo: <strong className="text-white font-mono">{DRIVE_DATABASE_FILENAME}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Última sincronização: <strong className="text-white">{formatDateTime(driveInfo.lastSyncAt)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Feedback de sucesso ou erro */}
          {feedback && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
          )}

          {/* Explicação de funcionamento Casa vs Empresa */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              Sincronização Multi-Dispositivo (Casa & Empresa)
            </h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              O sistema lê automaticamente o arquivo <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-semibold">{DRIVE_DATABASE_FILENAME}</code> ao iniciar e salva todas as suas alterações diretamente na nuvem em tempo real. Se você cadastrou um orçamento no computador da gráfica e abrir em casa, ele carregará exatamente os mesmos dados.
            </p>
          </div>

          {/* Ações manuais e de contingência */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Ações de Sincronização
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Botão Sincronizar Agora */}
              <button
                type="button"
                disabled={loading}
                onClick={handleManualSync}
                className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#01B8AA] rounded-xl transition-all duration-200 text-center group disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-[#01B8AA]/10 text-[#01B8AA] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </div>
                <span className="text-xs font-bold text-slate-800">Sincronizar Agora</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Grava dados pendentes na nuvem</span>
              </button>

              {/* Botão Baixar do Google Drive */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmPullOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl transition-all duration-200 text-center group disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Baixar do Drive</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Recarrega a versão mais recente da nuvem</span>
              </button>

              {/* Botão Enviar para o Google Drive */}
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmPushOpen(true)}
                className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-400 rounded-xl transition-all duration-200 text-center group disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">Enviar para o Drive</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Sobrescreve o arquivo no Drive com a base local</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

      {/* Diálogo de Confirmação para Enviar e Sobrescrever o Arquivo no Google Drive */}
      <ConfirmDialog
        isOpen={confirmPushOpen}
        onClose={() => setConfirmPushOpen(false)}
        onConfirm={handleConfirmPush}
        title="Sobrescrever banco de dados no Google Drive?"
        message={`Você está prestes a atualizar o arquivo "${DRIVE_DATABASE_FILENAME}" no seu Google Drive com todos os dados atuais deste navegador.\n\nEssa operação substituirá o conteúdo na nuvem pelas informações locais. Deseja prosseguir?`}
        confirmText="Sim, atualizar arquivo no Drive"
        cancelText="Cancelar"
        type="warning"
      />

      {/* Diálogo de Confirmação para Baixar e Sobrescrever Dados Locais */}
      <ConfirmDialog
        isOpen={confirmPullOpen}
        onClose={() => setConfirmPullOpen(false)}
        onConfirm={handleConfirmPull}
        title="Substituir dados locais pelos do Google Drive?"
        message={`Esta ação baixará o arquivo "${DRIVE_DATABASE_FILENAME}" do seu Google Drive e substituirá todos os cadastros e orçamentos locais pelos dados da nuvem.\n\nRecomendado ao trocar de computador (ex: da empresa para casa). Deseja continuar?`}
        confirmText="Sim, baixar e restaurar"
        cancelText="Cancelar"
        type="warning"
      />

      {/* Diálogo de Confirmação para Desconectar Google Drive */}
      <ConfirmDialog
        isOpen={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        onConfirm={handleConfirmDisconnect}
        title="Desconectar do Google Drive?"
        message="Ao desconectar, o sistema deixará de sincronizar na nuvem e passará a salvar apenas localmente no navegador até nova conexão. Seus dados no Google Drive permanecerão seguros."
        confirmText="Desconectar"
        cancelText="Cancelar"
        type="info"
      />
    </>
  );
};
