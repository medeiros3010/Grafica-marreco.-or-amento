/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Machine, StandardTask } from '../../types';
import { MachinesView } from '../machines/MachinesView';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { formatBRL } from '../../services/calculator';

interface MachinesAndTasksViewProps {
  machines: Machine[];
  tasks?: StandardTask[];
  onRefresh: () => void;
  initialTab?: string;
}

export const MachinesAndTasksView: React.FC<MachinesAndTasksViewProps> = ({
  machines,
  onRefresh,
}) => {
  // Estatísticas do parque de máquinas
  const activeMachinesCount = machines.filter((m) => m.active).length;
  const avgMachineCost =
    machines.length > 0
      ? machines.reduce((acc, m) => acc + (m.custoHora || 0), 0) / machines.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Banner Informativo do Parque de Máquinas & Equipamentos */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#01B8AA]/10 text-[#01B8AA] border border-[#01B8AA]/20 uppercase tracking-wide">
                Parque Fabril & Capacidade Produtiva
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#374151] tracking-tight">
              Máquinas & Equipamentos
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Cadastro centralizado do parque de equipamentos gráficos (impressoras offset, digitais, guilhotinas, dobradeiras, acabamentos). Os custos/hora ou custos por milheiro cadastrados aqui alimentam automaticamente todos os orçamentos e apontamentos em chão de fábrica.
            </p>
          </div>

          {/* Mini Cards de Indicadores Rápidos */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200/80">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[11px] font-medium">Máquinas Ativas</span>
                <Cpu className="w-3.5 h-3.5 text-[#01B8AA]" />
              </div>
              <div className="text-base font-bold text-[#374151]">
                {activeMachinesCount} <span className="text-[10px] text-gray-400 font-normal">/ {machines.length}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Média {formatBRL(avgMachineCost)}/h
              </div>
            </div>

            <div className="bg-teal-50/50 p-3 rounded-lg border border-teal-100">
              <div className="flex items-center justify-between text-teal-700 mb-1">
                <span className="text-[11px] font-medium">Integração Direta</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="text-xs font-semibold text-teal-900 mt-1">
                100% dos Orçamentos
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5">
                Alimentação de custos no Bloco A
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Renderização Exclusiva do Parque de Máquinas & Equipamentos */}
      <MachinesView machines={machines} onRefresh={onRefresh} />
    </div>
  );
};
