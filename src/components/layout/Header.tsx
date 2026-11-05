/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveTab } from './Sidebar';
import { storage, SaveStatus } from '../../services/storage';
import { CheckCircle2, Loader2, AlertCircle, CloudCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  currentProductTitle?: string;
  onNewAction?: () => void;
  newActionLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentProductTitle,
  onNewAction,
  newActionLabel,
}) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = storage.subscribeStatus((status, time, err) => {
      setSaveStatus(status);
      if (time) setLastSaved(time);
      setErrorMsg(err || null);
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

      {/* Zone 3: Status de Salvamento Automático & Ação Principal */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Indicador Visual Centralizado de Salvamento Automático */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 border ${
            saveStatus === 'saving'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : saveStatus === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
          title={
            saveStatus === 'saving'
              ? 'Persistindo alterações em tempo real no armazenamento centralizado...'
              : saveStatus === 'error'
              ? `Falha ao persistir: ${errorMsg || 'Erro no banco'}`
              : `Todos os dados salvos com sucesso às ${formatSavedTime(lastSaved)}`
          }
        >
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span className="text-[11px] font-semibold tracking-wide">Salvando...</span>
            </>
          )}

          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold tracking-wide">Salvo</span>
            </>
          )}

          {saveStatus === 'error' && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[11px] font-semibold tracking-wide">Erro ao salvar</span>
            </>
          )}
        </div>

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
