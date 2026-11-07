/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, ProductionLog, StandardTask } from '../../types';
import {
  computeProductComparisonSummary,
  formatBRL,
  formatPercent,
} from '../../services/calculator';
import { StatCard } from '../common/StatCard';
import {
  FileSpreadsheet,
  Coins,
  Filter,
  Download,
  Package,
  Cpu,
  Gauge,
  Activity,
} from 'lucide-react';

interface DashboardViewProps {
  products: Product[];
  logs: ProductionLog[];
  tasks: StandardTask[];
  onSelectProduct: (productId: string) => void;
  onGoToAnalysis: (productId: string) => void;
  onGoToLogs: (productId: string) => void;
  onOpenBackup?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  logs,
  onOpenBackup,
}) => {
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  // Clientes únicos para filtro
  const uniqueClients = Array.from(
    new Set(products.map((p) => p.client).filter(Boolean))
  ) as string[];

  // Filtrar produtos
  const filteredProducts = products.filter((p) => {
    const matchesClient = clientFilter === 'ALL' || p.client === clientFilter;
    return matchesClient;
  });

  // Calcular sumários para todos os produtos filtrados
  const summaries = filteredProducts.map((p) =>
    computeProductComparisonSummary(p, logs)
  );

  // Totais agregados gerais
  let totalPlannedCost = 0;
  let totalActualCost = 0;

  // Acumuladores consolidados de Matéria-Prima e Máquinas & Equipamentos
  let totalPlannedMaterials = 0;
  let totalActualMaterials = 0;
  let totalPlannedMachines = 0;
  let totalActualMachines = 0;

  for (const sum of summaries) {
    totalPlannedCost += sum.plannedTotalCost;
    totalActualCost += sum.actualTotalCost;

    totalPlannedMaterials += sum.plannedMaterialsCost || 0;
    totalActualMaterials += sum.actualMaterialsCost || 0;
    totalPlannedMachines += sum.plannedTasksCost || 0;
    totalActualMachines += sum.actualTasksCost || 0;
  }

  const netVariance = totalActualCost - totalPlannedCost;

  // Saldos acumulados específicos por categoria
  const diffMaterials = Number((totalActualMaterials - totalPlannedMaterials).toFixed(2));
  const diffMaterialsPct =
    totalPlannedMaterials > 0 ? (diffMaterials / totalPlannedMaterials) * 100 : null;

  const diffMachines = Number((totalActualMachines - totalPlannedMachines).toFixed(2));
  const diffMachinesPct =
    totalPlannedMachines > 0 ? (diffMachines / totalPlannedMachines) * 100 : null;

  // Dados para o Gráfico Consolidado Global (Barras Comparativas)
  const maxMacroCat = Math.max(
    totalPlannedMaterials,
    totalActualMaterials,
    totalPlannedMachines,
    totalActualMachines,
    1
  );

  const matPlannedBarWidth = Math.max(4, Math.round((totalPlannedMaterials / maxMacroCat) * 100));
  const matActualBarWidth = Math.max(4, Math.round((totalActualMaterials / maxMacroCat) * 100));

  const macPlannedBarWidth = Math.max(4, Math.round((totalPlannedMachines / maxMacroCat) * 100));
  const macActualBarWidth = Math.max(4, Math.round((totalActualMachines / maxMacroCat) * 100));

  // Distribuição percentual do custo real total (Velocímetro / Medidor de Equilíbrio)
  const totalActualConsolidated = totalActualMaterials + totalActualMachines;
  const matActualShare =
    totalActualConsolidated > 0
      ? Math.round((totalActualMaterials / totalActualConsolidated) * 100)
      : 50;
  const macActualShare = 100 - matActualShare;

  return (
    <div className="space-y-6">
      {/* Barra de Filtros do Dashboard */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            Filtros do Painel:
          </div>

          {uniqueClients.length > 0 && (
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            >
              <option value="ALL">Todos os Clientes ({uniqueClients.length})</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          )}

          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
            Modo Pós-Cálculo Ativo
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium tabular-nums">
            Visualizando {summaries.length} de {products.length} orçamentos
          </span>
          {onOpenBackup && (
            <button
              type="button"
              onClick={onOpenBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 text-[#01B8AA] font-semibold border border-[#01B8AA]/30 rounded-lg text-xs transition-colors cursor-pointer"
              title="Exportar tudo cadastrado em um único arquivo JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Tudo (JSON)</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartões KPIs Principais do Topo (Focado em: Produtos Cadastrados, Custo Total Orçado e Custo Total Realizado) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Produtos Cadastrados */}
        <StatCard
          label="Produtos Cadastrados"
          value={filteredProducts.length.toString()}
          subValue="Orçamentos no sistema"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          hint={`${summaries.length} orçamentos monitorados`}
        />

        {/* 2. Custo Total Orçado */}
        <StatCard
          label="Custo Total Orçado"
          value={formatBRL(totalPlannedCost)}
          icon={<Coins className="w-4 h-4" />}
          hint="Previsão de todos produtos"
        />

        {/* 3. Custo Total Realizado */}
        <StatCard
          label="Custo Total Realizado"
          value={formatBRL(totalActualCost)}
          icon={<Coins className="w-4 h-4" />}
          hint="Gasto efetivo apontado"
        />
      </div>

      {/* ========================================================================= */}
      {/* CONSOLIDAÇÃO GLOBAL MACRO (SALDO GLOBAL POR CATEGORIA) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
              Consolidação Global Macro
            </span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#01B8AA]" />
              Saldo Global por Categoria: Matéria-Prima vs Máquinas & Equipamentos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativo visual somando a variação total de todos os orçamentos e apontamentos do parque fabril
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-slate-400"></span>
              <span className="text-slate-600 font-medium">Orçado Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-[#01B8AA]"></span>
              <span className="text-slate-600 font-medium">Realizado Efetivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-[#EF4444]"></span>
              <span className="text-slate-600 font-medium">Estouro (&gt; Orçado)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-5">
          {/* Coluna 1 & 2: Barras Comparativas Horizontais por Categoria */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Categoria: Matérias-Primas (Insumos) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 rounded-md border border-amber-200">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 text-sm">Matérias-Primas (Insumos)</span>
                    <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
                      Papéis, tintas, chapas e embalagens de todos os produtos
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 tabular-nums">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Orçado</span>
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      {formatBRL(totalPlannedMaterials)}
                    </span>
                  </div>
                  <span className="text-slate-300">/</span>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Realizado</span>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {formatBRL(totalActualMaterials)}
                    </span>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <span className="text-[10px] text-slate-400 block uppercase">Saldo Global</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        diffMaterials > 0
                          ? 'text-[#EF4444]'
                          : diffMaterials < 0
                          ? 'text-[#10B981]'
                          : 'text-slate-500'
                      }`}
                    >
                      {diffMaterials > 0 ? `+${formatBRL(diffMaterials)}` : formatBRL(diffMaterials)}
                      {diffMaterialsPct !== null && (
                        <span className="text-[10px] ml-1 font-semibold">
                          ({diffMaterialsPct > 0 ? '+' : ''}{diffMaterialsPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra Horizontal Ampla Matérias-Primas */}
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1.5 w-full">
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[10px] text-slate-500 font-mono font-medium">Orçado</span>
                  <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-slate-400 rounded-full transition-all duration-300"
                      style={{ width: `${matPlannedBarWidth}%` }}
                    ></div>
                  </div>
                  <span className="w-14 text-right text-[10px] text-slate-400 font-mono">
                    {formatBRL(totalPlannedMaterials)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[10px] text-[#01B8AA] font-mono font-bold">Realizado</span>
                  <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        diffMaterials > 0 ? 'bg-[#EF4444]' : 'bg-[#01B8AA]'
                      }`}
                      style={{ width: `${matActualBarWidth}%` }}
                    ></div>
                  </div>
                  <span
                    className={`w-14 text-right text-[10px] font-mono font-bold ${
                      diffMaterials > 0 ? 'text-[#EF4444]' : 'text-[#01B8AA]'
                    }`}
                  >
                    {formatBRL(totalActualMaterials)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Categoria: Máquinas & Equipamentos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-50 rounded-md border border-teal-200">
                    <Cpu className="w-4 h-4 text-[#01B8AA]" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 text-sm">Máquinas & Equipamentos</span>
                    <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
                      Horas de acerto, horas de rodagem e taxas por milheiro do parque
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 tabular-nums">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Orçado</span>
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      {formatBRL(totalPlannedMachines)}
                    </span>
                  </div>
                  <span className="text-slate-300">/</span>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Realizado</span>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {formatBRL(totalActualMachines)}
                    </span>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <span className="text-[10px] text-slate-400 block uppercase">Saldo Global</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        diffMachines > 0
                          ? 'text-[#EF4444]'
                          : diffMachines < 0
                          ? 'text-[#10B981]'
                          : 'text-slate-500'
                      }`}
                    >
                      {diffMachines > 0 ? `+${formatBRL(diffMachines)}` : formatBRL(diffMachines)}
                      {diffMachinesPct !== null && (
                        <span className="text-[10px] ml-1 font-semibold">
                          ({diffMachinesPct > 0 ? '+' : ''}{diffMachinesPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra Horizontal Ampla Máquinas */}
              <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1.5 w-full">
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[10px] text-slate-500 font-mono font-medium">Orçado</span>
                  <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-slate-400 rounded-full transition-all duration-300"
                      style={{ width: `${macPlannedBarWidth}%` }}
                    ></div>
                  </div>
                  <span className="w-14 text-right text-[10px] text-slate-400 font-mono">
                    {formatBRL(totalPlannedMachines)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[10px] text-[#01B8AA] font-mono font-bold">Realizado</span>
                  <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        diffMachines > 0 ? 'bg-[#EF4444]' : 'bg-[#01B8AA]'
                      }`}
                      style={{ width: `${macActualBarWidth}%` }}
                    ></div>
                  </div>
                  <span
                    className={`w-14 text-right text-[10px] font-mono font-bold ${
                      diffMachines > 0 ? 'text-[#EF4444]' : 'text-[#01B8AA]'
                    }`}
                  >
                    {formatBRL(totalActualMachines)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3: Velocímetro / Indicador de Equilíbrio & Composição Global */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-[#01B8AA]" />
                  Composição do Gasto Real
                </span>
                <span className="text-[10px] font-mono text-slate-500">100% dos Custos</span>
              </div>

              {/* Barra Bipolar de Proporção Insumos vs Máquinas */}
              <div className="space-y-1.5 mt-3">
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${matActualShare}%` }}
                    title={`Matérias-Primas: ${matActualShare}% (${formatBRL(totalActualMaterials)})`}
                  ></div>
                  <div
                    className="h-full bg-[#01B8AA] transition-all duration-300"
                    style={{ width: `${macActualShare}%` }}
                    title={`Máquinas & Equipamentos: ${macActualShare}% (${formatBRL(totalActualMachines)})`}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-semibold pt-1">
                  <span className="text-amber-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    MP: {matActualShare}%
                  </span>
                  <span className="text-[#00897B] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#01B8AA]"></span>
                    Máquinas: {macActualShare}%
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnóstico Geral do Parque Fabril */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium">Balanço Geral:</span>
                <span
                  className={`font-mono font-bold ${
                    netVariance > 0 ? 'text-[#EF4444]' : netVariance < 0 ? 'text-[#10B981]' : 'text-slate-700'
                  }`}
                >
                  {netVariance > 0 ? `+${formatBRL(netVariance)}` : formatBRL(netVariance)}
                </span>
              </div>
              <div
                className={`p-2.5 rounded-lg text-center text-xs font-bold border ${
                  netVariance < 0
                    ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                    : netVariance > 0
                    ? 'bg-rose-100/70 border-rose-300 text-rose-900'
                    : 'bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                {netVariance < 0
                  ? 'Superávit Operacional Conquistado'
                  : netVariance > 0
                  ? 'Atenção: Custo Acima do Previsto'
                  : 'Produção Perfeitamente Balanceada'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                Saldo acumulado líquido de todos os orçamentos e apontamentos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
