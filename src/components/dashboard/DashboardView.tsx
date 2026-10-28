/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, ProductionLog, StandardTask, ProductStatus } from '../../types';
import {
  computeProductComparisonSummary,
  formatBRL,
  formatPercent,
  formatSecondsToTime,
} from '../../services/calculator';
import { StatCard } from '../common/StatCard';
import { ProductStatusBadge } from '../common/Badge';
import {
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Coins,
  ArrowRight,
  Filter,
  Layers,
} from 'lucide-react';

interface DashboardViewProps {
  products: Product[];
  logs: ProductionLog[];
  tasks: StandardTask[];
  onSelectProduct: (productId: string) => void;
  onGoToAnalysis: (productId: string) => void;
  onGoToLogs: (productId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  logs,
  tasks,
  onSelectProduct,
  onGoToAnalysis,
  onGoToLogs,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  // Clientes únicos para filtro
  const uniqueClients = Array.from(
    new Set(products.map((p) => p.client).filter(Boolean))
  ) as string[];

  // Filtrar produtos
  const filteredProducts = products.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesClient = clientFilter === 'ALL' || p.client === clientFilter;
    return matchesStatus && matchesClient;
  });

  // Calcular sumários para todos os produtos filtrados
  const summaries = filteredProducts.map((p) =>
    computeProductComparisonSummary(p, logs)
  );

  // Totais agregados
  let totalPlannedCost = 0;
  let totalActualCost = 0;
  let totalPlannedSeconds = 0;
  let totalActualSeconds = 0;
  let totalOverruns = 0;
  let totalSavings = 0;

  let inProgressCount = 0;
  let completedCount = 0;
  let draftOrApprovedCount = 0;

  for (const sum of summaries) {
    totalPlannedCost += sum.plannedTotalCost;
    totalActualCost += sum.actualTotalCost;
    totalPlannedSeconds += sum.plannedTotalSeconds;
    totalActualSeconds += sum.actualTotalSeconds;
    totalOverruns += sum.totalCostOverruns;
    totalSavings += sum.totalCostSavings;

    if (sum.status === 'EM_PRODUCAO') inProgressCount++;
    else if (sum.status === 'CONCLUIDO') completedCount++;
    else draftOrApprovedCount++;
  }

  const netVariance = totalActualCost - totalPlannedCost;
  const netVariancePercent =
    totalPlannedCost > 0 ? (netVariance / totalPlannedCost) * 100 : null;

  // Compilar todas as operações para descobrir as de maior desvio excedente
  interface FlatOpDeviation {
    productCode: string;
    productName: string;
    productId: string;
    opCode: string;
    opName: string;
    machine?: string;
    diffCost: number;
    variancePct: number | null;
    isPending: boolean;
  }

  const allOpDeviations: FlatOpDeviation[] = [];
  summaries.forEach((sum) => {
    sum.operations.forEach((op) => {
      if (!op.isPending) {
        allOpDeviations.push({
          productCode: sum.productCode,
          productName: sum.productName,
          productId: sum.productId,
          opCode: op.code,
          opName: op.name,
          machine: op.machine,
          diffCost: op.financialDifference,
          variancePct: op.financialVariancePercent,
          isPending: op.isPending,
        });
      }
    });
  });

  // Ordenar operações por maior custo excedente
  const worstDeviations = allOpDeviations
    .filter((op) => op.diffCost > 0)
    .sort((a, b) => b.diffCost - a.diffCost)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Barra de Filtros do Dashboard */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            Filtros do Painel:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          >
            <option value="ALL">Todos os Status</option>
            <option value="EM_PRODUCAO">Em Produção</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="APROVADO">Aprovados</option>
            <option value="RASCUNHO">Rascunhos</option>
          </select>

          {uniqueClients.length > 0 && (
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            >
              <option value="ALL">Todos os Clientes</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-xs text-slate-500 font-medium tabular-nums">
          Visualizando {summaries.length} de {products.length} produtos
        </span>
      </div>

      {/* Cartões KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Produtos Cadastrados"
          value={filteredProducts.length.toString()}
          subValue={`${inProgressCount} em produção`}
          icon={<FileSpreadsheet className="w-4 h-4" />}
          hint={`${completedCount} concluídos · ${draftOrApprovedCount} em espera`}
        />

        <StatCard
          label="Custo Total Orçado"
          value={formatBRL(totalPlannedCost)}
          icon={<Coins className="w-4 h-4" />}
          hint="Revisões aprovadas"
        />

        <StatCard
          label="Custo Total Realizado"
          value={formatBRL(totalActualCost)}
          icon={<Coins className="w-4 h-4" />}
          hint="Gasto efetivo apontado"
        />

        <StatCard
          label="Saldo Financeiro"
          value={netVariance > 0 ? `+${formatBRL(netVariance)}` : formatBRL(netVariance)}
          trend={{
            value: formatPercent(netVariancePercent),
            isPositive: netVariance > 0,
            positiveIsGood: false,
          }}
          icon={
            netVariance > 0 ? (
              <TrendingUp className="w-4 h-4 text-rose-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            )
          }
          hint={netVariance > 0 ? 'Gasto acima do orçado' : 'Economia acumulada'}
        />

        <StatCard
          label="Horas Orçadas"
          value={(totalPlannedSeconds / 3600).toFixed(1) + 'h'}
          icon={<Clock className="w-4 h-4" />}
          subValue={formatSecondsToTime(totalPlannedSeconds)}
        />

        <StatCard
          label="Horas Realizadas"
          value={(totalActualSeconds / 3600).toFixed(1) + 'h'}
          trend={{
            value: formatPercent(
              totalPlannedSeconds > 0
                ? ((totalActualSeconds - totalPlannedSeconds) / totalPlannedSeconds) * 100
                : null
            ),
            isPositive: totalActualSeconds > totalPlannedSeconds,
            positiveIsGood: false,
          }}
          icon={<Clock className="w-4 h-4" />}
          hint={formatSecondsToTime(totalActualSeconds)}
        />
      </div>

      {/* Bloco de Desvios Positivos e Economias Separados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
              Desvios Positivos (Gastos Além do Previsto)
            </span>
            <span className="text-2xl font-bold text-rose-950 font-mono tabular-nums block mt-1">
              +{formatBRL(totalOverruns)}
            </span>
            <p className="text-[11px] text-rose-800/80 mt-0.5">
              Soma estrita das etapas que excederam seus orçamentos individuais.
            </p>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-400 shrink-0" />
        </div>

        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Economias Operacionais Conquistadas
            </span>
            <span className="text-2xl font-bold text-emerald-950 font-mono tabular-nums block mt-1">
              -{formatBRL(totalSavings)}
            </span>
            <p className="text-[11px] text-emerald-800/80 mt-0.5">
              Soma estrita das etapas concluídas com custos inferiores ao orçamento.
            </p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 e 2: Ordens em Chão de Fábrica e Desvios de Cada Produto */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Acompanhamento Operacional por Produto
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Custos acumulados até o momento versus valores previstos
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {summaries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum produto atende aos filtros atuais.
              </div>
            ) : (
              summaries.map((sum) => {
                const diff = sum.financialDifference;
                const isOver = diff > 0;
                return (
                  <div
                    key={sum.productId}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {sum.productCode}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{sum.productName}</h4>
                        <ProductStatusBadge status={sum.status} />
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        {sum.client && <span>Cliente: <strong>{sum.client}</strong></span>}
                        <span>·</span>
                        <span>{sum.completedOperations} de {sum.totalOperations} operações concluídas</span>
                        {sum.pendingOperations > 0 && (
                          <span className="text-slate-400 font-medium">({sum.pendingOperations} pendentes)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                          Orçado x Real
                        </span>
                        <div className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                          {formatBRL(sum.plannedTotalCost)} /{' '}
                          <strong className="text-slate-900">{formatBRL(sum.actualTotalCost)}</strong>
                        </div>
                      </div>

                      <div className="text-right min-w-[90px]">
                        <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                          Desvio
                        </span>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums block ${
                            isOver ? 'text-rose-700' : diff < 0 ? 'text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          {isOver ? `+${formatBRL(diff)}` : formatBRL(diff)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold tabular-nums ${
                            isOver ? 'text-rose-700' : diff < 0 ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {formatPercent(sum.financialVariancePercent)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onGoToLogs(sum.productId)}
                          title="Lançar apontamento"
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Apontar
                        </button>
                        <button
                          onClick={() => onGoToAnalysis(sum.productId)}
                          title="Ver análise completa"
                          className="p-1.5 text-[#01B8AA] hover:bg-[#01B8AA]/10 rounded-lg transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna 3: Maiores Desvios Excedentes no Parque Gráfico */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Top Desvios Excedentes
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Operações que mais extrapolaram o orçamento previsto
            </p>
          </div>

          <div className="p-4 divide-y divide-slate-100 space-y-3">
            {worstDeviations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Nenhum estouro financeiro registrado nas operações atuais.
              </div>
            ) : (
              worstDeviations.map((dev, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {dev.opCode} - {dev.opName}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                        Em: {dev.productName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-rose-700 tabular-nums block">
                        +{formatBRL(dev.diffCost)}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-600 tabular-nums">
                        {formatPercent(dev.variancePct)}
                      </span>
                    </div>
                  </div>
                  {dev.machine && (
                    <div className="text-[10px] text-slate-400">
                      Máquina: {dev.machine}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
