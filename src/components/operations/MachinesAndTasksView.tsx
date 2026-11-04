/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Machine, StandardTask } from '../../types';
import { MachinesView } from '../machines/MachinesView';
import { TasksView } from '../tasks/TasksView';
import { Cpu, Layers, CheckCircle2, DollarSign, Clock, HelpCircle } from 'lucide-react';
import { formatBRL } from '../../services/calculator';

interface MachinesAndTasksViewProps {
  machines: Machine[];
  tasks: StandardTask[];
  onRefresh: () => void;
  initialTab?: 'machines' | 'tasks';
}

export const MachinesAndTasksView: React.FC<MachinesAndTasksViewProps> = ({
  machines,
  tasks,
  onRefresh,
  initialTab = 'machines',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'machines' | 'tasks'>(initialTab);

  // Estatísticas consolidadas
  const activeMachinesCount = machines.filter((m) => m.active).length;
  const avgMachineCost =
    machines.length > 0
      ? machines.reduce((acc, m) => acc + (m.custoHora || 0), 0) / machines.length
      : 0;

  const activeTasksCount = tasks.filter((t) => t.active).length;
  const tasksByHour = tasks.filter((t) => !t.billingUnit || t.billingUnit === 'HORA').length;
  const tasksByThousand = tasks.filter((t) => t.billingUnit === 'MILHEIRO').length;

  return (
    <div className="space-y-6">
      {/* Banner Informativo da Área Unificada */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#01B8AA]/10 text-[#01B8AA] border border-[#01B8AA]/20 uppercase tracking-wide">
                Gestão Unificada de Capacidade & Processos
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#374151] tracking-tight">
              Máquinas & Tarefas Produtivas
            </h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Estrutura centralizada do parque fabril. As <strong>máquinas</strong> registram seus custos horários específicos, enquanto as <strong>tarefas</strong> são cadastradas uma única vez e ficam disponíveis para todos os orçamentos e apontamentos, podendo ser cobradas por hora ou por milheiro.
            </p>
          </div>

          {/* Mini Cards de Indicadores Rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
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

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200/80">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[11px] font-medium">Tarefas Globais</span>
                <Layers className="w-3.5 h-3.5 text-[#01B8AA]" />
              </div>
              <div className="text-base font-bold text-[#374151]">
                {tasks.length}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {tasksByHour} p/ hora · {tasksByThousand} p/ milheiro
              </div>
            </div>

            <div className="hidden sm:block bg-teal-50/50 p-3 rounded-lg border border-teal-100">
              <div className="flex items-center justify-between text-teal-700 mb-1">
                <span className="text-[11px] font-medium">Reutilização</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="text-xs font-semibold text-teal-900 mt-1">
                100% Compartilhadas
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5">
                Sem duplicação de dados
              </div>
            </div>
          </div>
        </div>

        {/* Abas Segmentadas para Navegação entre Máquinas e Tarefas */}
        <div className="mt-6 pt-4 border-t border-gray-150 flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex p-1 bg-gray-100/90 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveSubTab('machines')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'machines'
                  ? 'bg-white text-[#374151] shadow-xs ring-1 ring-gray-200'
                  : 'text-gray-600 hover:text-[#374151] hover:bg-white/50'
              }`}
            >
              <Cpu className={`w-4 h-4 ${activeSubTab === 'machines' ? 'text-[#01B8AA]' : 'text-gray-400'}`} />
              <span>Máquinas & Equipamentos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  activeSubTab === 'machines'
                    ? 'bg-[#01B8AA]/15 text-[#01B8AA]'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {machines.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'tasks'
                  ? 'bg-white text-[#374151] shadow-xs ring-1 ring-gray-200'
                  : 'text-gray-600 hover:text-[#374151] hover:bg-white/50'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeSubTab === 'tasks' ? 'text-[#01B8AA]' : 'text-gray-400'}`} />
              <span>Tarefas & Processos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  activeSubTab === 'tasks'
                    ? 'bg-[#01B8AA]/15 text-[#01B8AA]'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tasks.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>
              {activeSubTab === 'machines'
                ? 'Equipamentos físicos e taxas horárias de operação'
                : 'Processos produtivos parametrizados para inserção direta em orçamentos'}
            </span>
          </div>
        </div>
      </div>

      {/* Renderização do Sub-Componente Selecionado */}
      {activeSubTab === 'machines' ? (
        <MachinesView machines={machines} onRefresh={onRefresh} />
      ) : (
        <TasksView tasks={tasks} onRefresh={onRefresh} />
      )}
    </div>
  );
};
