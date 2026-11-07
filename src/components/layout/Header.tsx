/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveTab } from './Sidebar';
import { storage, SaveStatus } from '../../services/storage';
import { CheckCircle2, Loader2, AlertCircle, Cloud, RefreshCw, Download, FileJson } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  currentProductTitle?: string;
  onNewAction?: () => void;
  newActionLabel?: string;
  onOpenGoogleDriveModal?: () => void;
  onOpenGoogleAuth?: () => void;
  onOpenBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentProductTitle,
  onNewAction,
  newActionLabel,
  onOpenGoogleDriveModal,
  onOpenGoogleAuth,
  onOpenBackup,
}) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [driveDetails, setDriveDetails] = useState<{
    fileId: string | null;
    fileName: string;
    lastSyncAt: Date | null;
    userEmail: string | null;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = storage.subscribeStatus((status, time, err, isDrive, driveInfo) => {
      setSaveStatus(status);
      if (time) setLastSaved(time);
      setErrorMsg(err || null);
      if (typeof isDrive === 'boolean') setIsDriveConnected(isDrive);
      if (driveInfo) setDriveDetails(driveInfo);
    });
    return unsubscribe;
  }, []);

  const titles: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Painel Geral',
      subtitle: 'Visão consolidada de orçamentos, ordens em chão de fábrica e análise de desvios',
    },
    'machines-tasks': {
      title: 'Máquinas & Tarefas Produtivas',
      subtitle: 'Gestão unificada do parque gráfico, custos/hora de equipamentos e catálogo de tarefas parametrizadas',
    },
    materials: {
      title: 'Catálogo de Matérias-Primas (Insumos)',
      subtitle: 'Papéis, cartões, tintas, colas e chapas com custo unitário padrão por unidade de medida',
    },
    products: {
      title: 'Produtos & Orçamentos (3 Blocos)',
      subtitle: 'Bloco A (Custos MP + Tarefas), Bloco B (Markup por dentro) e Bloco C (Impostos por fora e Preço Final)',
    },
    logs: {
      title: 'Apontamento do Realizado (Layout Espelho)',
      subtitle: 'Interface lado a lado: O Orçado de referência (esquerda) x O Realizado do chão de fábrica (direita) com prévia comparativa imediata',
    },
    analysis: {
      title: 'Comparativo Orçado x Realizado & Margem',
      subtitle: 'Diferenças de custo, consumo real de materiais e impacto financeiro direto na margem de lucro',
    },
  };

  const { title, subtitle } = titles[activeTab] || titles.dashboard;

  const formatSavedTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Rótulos de persistência rigorosamente conforme solicitado:
  // "Salvando no Google Drive...", "Salvo no Google Drive", "Erro ao sincronizar"
  const getPersistenceBadgeText = () => {
    if (isDriveConnected) {
      if (saveStatus === 'saving') return 'Salvando no Google Drive...';
      if (saveStatus === 'error') return 'Erro ao sincronizar';
      return 'Salvo no Google Drive';
    } else {
      if (saveStatus === 'saving') return 'Salvando...';
      if (saveStatus === 'error') return 'Erro ao salvar';
      return 'Salvo localmente';
    }
  };

  return (
    <header className="h-16 px-6 bg-white border-b border-gray-200/90 flex items-center justify-between shrink-0 shadow-xs z-10">
      {/* Zone 1 & 2: Title & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-[#374151] tracking-tight leading-none whitespace-nowrap">
              {title}
            </h2>
            {currentProductTitle && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-xs font-semibold text-[#01B8AA] bg-[#01B8AA]/10 px-2.5 py-0.5 rounded-md border border-[#01B8AA]/20 truncate max-w-xs">
                  {currentProductTitle}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 hidden sm:block truncate max-w-xl">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Zone 3: Status de Persistência no Google Drive & Ações */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Indicador Visual Centralizado de Persistência */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
            saveStatus === 'saving'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : saveStatus === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isDriveConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}
          title={
            isDriveConnected
              ? saveStatus === 'saving'
                ? 'Sincronizando arquivo dados_grafica_database.json diretamente no Google Drive...'
                : saveStatus === 'error'
                ? `Falha ao persistir no Google Drive: ${errorMsg || 'Erro na nuvem'}`
                : `Arquivo dados_grafica_database.json sincronizado no Google Drive às ${formatSavedTime(lastSaved)}`
              : `Salvo localmente no navegador às ${formatSavedTime(lastSaved)}. Conecte o Google Drive para persistir em nuvem.`
          }
        >
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span className="text-[11px] font-semibold tracking-wide">
                {getPersistenceBadgeText()}
              </span>
            </>
          )}

          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isDriveConnected ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="text-[11px] font-semibold tracking-wide">
                {getPersistenceBadgeText()}
              </span>
            </>
          )}

          {saveStatus === 'error' && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[11px] font-semibold tracking-wide">
                {getPersistenceBadgeText()}
              </span>
            </>
          )}
        </div>

        {/* Botão de Conexão / Gerenciamento do Google Drive */}
        {isDriveConnected ? (
          <button
            type="button"
            onClick={onOpenGoogleDriveModal}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Gerenciar conexão com o Google Drive"
          >
            <Cloud className="w-4 h-4 text-[#01B8AA]" />
            <span className="hidden md:inline font-mono text-[11px] max-w-[130px] truncate">
              {driveDetails?.userEmail || 'Google Drive'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenGoogleAuth}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#01B8AA] text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Conectar ao Google Drive para sincronizar entre empresa e casa"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-3.5 h-3.5">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span className="hidden sm:inline">Conectar Google Drive</span>
          </button>
        )}

        {/* Botão de Exportar Tudo em JSON */}
        {onOpenBackup && (
          <button
            type="button"
            onClick={onOpenBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#01B8AA] text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Exportar tudo cadastrado em um único arquivo JSON (máquinas, tarefas, produtos, etc.)"
          >
            <Download className="w-3.5 h-3.5 text-[#01B8AA]" />
            <span className="hidden sm:inline">Exportar Tudo (JSON)</span>
          </button>
        )}

        {/* Botão de Nova Ação Primária se aplicável */}
        {onNewAction && newActionLabel && (
          <button
            onClick={onNewAction}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            {newActionLabel}
          </button>
        )}
      </div>
    </header>
  );
};
