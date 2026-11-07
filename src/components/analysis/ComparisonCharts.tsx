/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProductComparisonSummary } from '../../types';
import { formatBRL } from '../../services/calculator';
import { Layers, Cpu, Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ComparisonChartsProps {
  summary: ProductComparisonSummary;
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ summary }) => {
  // Linha 2: Dados de categorias - consome da fonte única Máquinas e Materiais
  const categories = [
    {
      name: 'Máquina / Tarefas',
      description: 'Taxas operacionais e custos de hora/milheiro do parque fabril',
      icon: <Cpu className="w-4 h-4 text-[#01B8AA]" />,
      planned:
        summary.plannedTasksCost > 0
          ? summary.plannedTasksCost
          : (summary.plannedMachineCost + summary.plannedLaborCost),
      actual:
        summary.actualTasksCost > 0
          ? summary.actualTasksCost
          : (summary.actualMachineCost + summary.actualLaborCost),
    },
    {
      name: 'Materiais / Insumos',
      description: 'Papéis, tintas, chapas, colas e matérias-primas do Bloco A',
      icon: <Package className="w-4 h-4 text-amber-500" />,
      planned: summary.plannedMaterialCost,
      actual: summary.actualMaterialCost,
    },
  ];

  const maxCategory = Math.max(
    ...categories.map((c) => Math.max(c.planned, c.actual)),
    1
  );

  // Linha 3: Dados de operações / processos (em formato de lista/tabela detalhada por linha)
  const opData =
    summary.processos && summary.processos.length > 0
      ? summary.processos.map((proc, idx) => ({
          order: proc.order || idx + 1,
          name: proc.nome,
          code: `#${proc.order || idx + 1} ${proc.tipoItem === 'MAQUINA' ? 'Máq' : 'Proc'}`,
          status: proc.status || 'CONCLUIDA',
          planned: proc.custoTotal,
          actual: proc.custoTotalReal !== undefined ? proc.custoTotalReal : proc.custoTotal,
          isPending: proc.status !== 'CONCLUIDA' && proc.custoTotalReal === undefined,
        }))
      : summary.operations.map((op, idx) => ({
          order: idx + 1,
          name: op.name,
          code: op.code,
          status: op.isPending ? 'PENDENTE' : 'CONCLUIDA',
          planned: op.plannedTotalCost,
          actual: op.actualTotalCost,
          isPending: op.isPending,
        }));

  const maxOp = Math.max(
    ...opData.map((o) => Math.max(o.planned, o.actual)),
    1
  );

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* LINHA 2: ORÇADO X REALIZADO POR CATEGORIA DE CUSTO (LARGURA TOTAL AMPLA) */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
              Linha 2 · Consolidação por Categoria
            </span>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              Orçado x Realizado por Categoria de Custo
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativo direto e proporcional de Máquina / Tarefas e Materiais / Insumos em barras horizontais amplas
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-slate-400"></span>
              <span className="text-slate-600 font-medium">Orçado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-[#01B8AA]"></span>
              <span className="text-slate-600 font-medium">Realizado Efetivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-xs bg-[#EF4444]"></span>
              <span className="text-slate-600 font-medium">Estouro (Acima do Orçado)</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 pt-3">
          {categories.map((cat) => {
            const plannedWidth = Math.max(2, Math.round((cat.planned / maxCategory) * 100));
            const actualWidth = Math.max(2, Math.round((cat.actual / maxCategory) * 100));
            const diff = Number((cat.actual - cat.planned).toFixed(2));
            const diffPct = cat.planned > 0 ? (diff / cat.planned) * 100 : null;

            return (
              <div key={cat.name} className="py-4 first:pt-2 last:pb-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 rounded-md shrink-0">
                      {cat.icon}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                      <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
                        {cat.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 tabular-nums self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Orçado</span>
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {formatBRL(cat.planned)}
                      </span>
                    </div>
                    <span className="text-slate-300">/</span>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Realizado</span>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {formatBRL(cat.actual)}
                      </span>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <span className="text-[10px] text-slate-400 block uppercase">Desvio</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          diff > 0 ? 'text-[#EF4444]' : diff < 0 ? 'text-[#10B981]' : 'text-slate-400'
                        }`}
                      >
                        {diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)}
                        {diffPct !== null && (
                          <span className="text-[10px] ml-1 font-semibold">
                            ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra Horizontal Ampla em Largura Total */}
                <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1.5 w-full">
                  {/* Barra Orçada */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-[10px] text-slate-500 font-mono font-medium">Orçado</span>
                    <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-300"
                        style={{ width: `${plannedWidth}%` }}
                      ></div>
                    </div>
                    <span className="w-12 text-right text-[10px] text-slate-400 font-mono">
                      {plannedWidth}%
                    </span>
                  </div>

                  {/* Barra Realizada */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-[10px] text-[#01B8AA] font-mono font-bold">Realizado</span>
                    <div className="flex-1 h-3.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          diff > 0 ? 'bg-[#EF4444]' : 'bg-[#01B8AA]'
                        }`}
                        style={{ width: `${actualWidth}%` }}
                      ></div>
                    </div>
                    <span
                      className={`w-12 text-right text-[10px] font-mono font-bold ${
                        diff > 0 ? 'text-[#EF4444]' : 'text-[#01B8AA]'
                      }`}
                    >
                      {actualWidth}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LINHA 3: CUSTOS POR OPERAÇÃO EM FORMATO DE LISTA/TABELA DETALHADA POR LINHA */}
      {/* ========================================================================= */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
              Linha 3 · Rastreamento Operacional
            </span>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Custos por Operação (Orçado x Realizado)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Detalhamento por linha de cada operação ou máquina produtiva com desvio financeiro e barra visual
            </p>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total de etapas: <strong>{opData.length}</strong>
          </div>
        </div>

        {opData.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Nenhuma operação cadastrada neste produto para comparação.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 pt-2">
            {opData.map((op) => {
              const plannedWidth = Math.max(2, Math.round((op.planned / maxOp) * 100));
              const actualWidth = Math.max(2, Math.round((op.actual / maxOp) * 100));
              const diff = Number((op.actual - op.planned).toFixed(2));
              const diffPct = op.planned > 0 ? (diff / op.planned) * 100 : null;

              return (
                <div key={op.code} className="py-3.5 space-y-2">
                  {/* Linha de Dados da Operação */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {op.code}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{op.name}</span>
                      {op.isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Apontada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 tabular-nums self-end lg:self-center">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Orçado</span>
                        <span className="font-mono text-xs font-medium text-slate-600">
                          {formatBRL(op.planned)}
                        </span>
                      </div>
                      <span className="text-slate-300">/</span>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase">Realizado</span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {op.isPending ? 'Pendente' : formatBRL(op.actual)}
                        </span>
                      </div>
                      <div className="text-right min-w-[110px]">
                        <span className="text-[10px] text-slate-400 block uppercase">Desvio</span>
                        {op.isPending ? (
                          <span className="text-[11px] text-slate-400 italic">Aguardando</span>
                        ) : (
                          <span
                            className={`font-mono text-xs font-bold ${
                              diff > 0 ? 'text-[#EF4444]' : diff < 0 ? 'text-[#10B981]' : 'text-slate-400'
                            }`}
                          >
                            {diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)}
                            {diffPct !== null && (
                              <span className="text-[10px] ml-1 font-semibold">
                                ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Barra Comparativa por Operação em Largura Total */}
                  <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-100 flex items-center gap-3">
                    <span className="w-14 text-[10px] text-slate-400 font-mono">Progresso</span>
                    <div className="flex-1 space-y-1">
                      {/* Barra Orçada */}
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-400 rounded-full"
                          style={{ width: `${plannedWidth}%` }}
                        ></div>
                      </div>
                      {/* Barra Realizada */}
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            op.isPending
                              ? 'bg-slate-300'
                              : diff > 0
                              ? 'bg-[#EF4444]'
                              : 'bg-[#01B8AA]'
                          }`}
                          style={{ width: `${op.isPending ? 0 : actualWidth}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-[10px] font-mono text-slate-400">
                      {op.isPending ? 'Pendente' : `${actualWidth}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
