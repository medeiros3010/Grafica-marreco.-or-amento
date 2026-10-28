/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ActiveTab } from './Sidebar';

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
  const titles: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Painel Geral',
      subtitle: 'Visão consolidada de orçamentos, ordens em chão de fábrica e análise de desvios',
    },
    machines: {
      title: 'Cadastro de Máquinas & Custo/Hora',
      subtitle: 'Parque gráfico, custo horário padrão das máquinas e vinculação automática com as tarefas',
    },
    materials: {
      title: 'Catálogo de Matérias-Primas (Insumos)',
      subtitle: 'Papéis, cartões, tintas, colas e chapas com custo unitário padrão por unidade de medida',
    },
    tasks: {
      title: 'Cadastro de Tarefas & Operações',
      subtitle: 'Operações produtivas reutilizáveis, parâmetros de tempo e custos padrão vinculados às máquinas',
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

  return (
    <header className="h-16 px-6 bg-white border-b border-gray-200/90 flex items-center justify-between shrink-0 shadow-xs z-10">
      {/* Zone 1 & 2: Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#374151] tracking-tight leading-none">
              {title}
            </h2>
            {currentProductTitle && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-xs font-semibold text-[#01B8AA] bg-[#01B8AA]/10 px-2.5 py-0.5 rounded-md border border-[#01B8AA]/20">
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

      {/* Zone 3: Primary action button if applicable */}
      {onNewAction && newActionLabel && (
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onNewAction}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            {newActionLabel}
          </button>
        </div>
      )}
    </header>
  );
};
