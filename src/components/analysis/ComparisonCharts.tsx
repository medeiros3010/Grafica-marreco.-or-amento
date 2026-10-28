/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProductComparisonSummary } from '../../types';
import { formatBRL, formatSecondsToTime } from '../../services/calculator';

interface ComparisonChartsProps {
  summary: ProductComparisonSummary;
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ summary }) => {
  // Dados de categorias
  const categories = [
    {
      name: 'Mão de Obra',
      planned: summary.plannedLaborCost,
      actual: summary.actualLaborCost,
    },
    {
      name: 'Máquina',
      planned: summary.plannedMachineCost,
      actual: summary.actualMachineCost,
    },
    {
      name: 'Materiais / Insumos',
      planned: summary.plannedMaterialCost,
      actual: summary.actualMaterialCost,
    },
  ];

  const maxCategory = Math.max(
    ...categories.map((c) => Math.max(c.planned, c.actual)),
    1
  );

  // Dados de operações
  const opData = summary.operations.map((op) => ({
    name: op.name,
    code: op.code,
    planned: op.plannedTotalCost,
    actual: op.actualTotalCost,
    isPending: op.isPending,
  }));

  const maxOp = Math.max(
    ...opData.map((o) => Math.max(o.planned, o.actual)),
    1
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico 1: Orçado x Realizado por Categoria */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Orçado x Realizado por Categoria de Custo
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Comparativo direto de Mão de Obra, Máquina e Materiais em Reais (R$)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-slate-400"></span>
              <span className="text-slate-600">Orçado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#01B8AA]"></span>
              <span className="text-slate-600">Realizado</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {categories.map((cat) => {
            const plannedWidth = Math.max(2, Math.round((cat.planned / maxCategory) * 100));
            const actualWidth = Math.max(2, Math.round((cat.actual / maxCategory) * 100));
            const diff = cat.actual - cat.planned;

            return (
              <div key={cat.name} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-slate-800">{cat.name}</span>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-slate-500 font-mono">{formatBRL(cat.planned)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900 font-mono">{formatBRL(cat.actual)}</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        diff > 0 ? 'text-[#EF4444]' : diff < 0 ? 'text-[#10B981]' : 'text-slate-400'
                      }`}
                    >
                      ({diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)})
                    </span>
                  </div>
                </div>

                {/* Barras Horizontais */}
                <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {/* Barra Orçada */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-slate-400 font-mono">Orçado</span>
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-300"
                        style={{ width: `${plannedWidth}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Barra Realizada */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-[#01B8AA] font-mono font-semibold">Realiz.</span>
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          diff > 0 ? 'bg-[#EF4444]' : 'bg-[#01B8AA]'
                        }`}
                        style={{ width: `${actualWidth}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gráfico 2: Orçado x Realizado por Operação */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Custos por Operação (Orçado x Realizado)
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Identificação visual de desvios operacionais na sequência de produção
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {opData.map((op) => {
            const plannedWidth = Math.max(2, Math.round((op.planned / maxOp) * 100));
            const actualWidth = Math.max(2, Math.round((op.actual / maxOp) * 100));
            const diff = op.actual - op.planned;

            return (
              <div key={op.code} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-medium">
                  <div className="truncate max-w-[200px]">
                    <span className="font-mono font-bold text-slate-700 mr-1.5">{op.code}</span>
                    <span className="text-slate-800">{op.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-slate-500 font-mono">{formatBRL(op.planned)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {op.isPending ? 'Pendente' : formatBRL(op.actual)}
                    </span>
                    {!op.isPending && (
                      <span
                        className={`text-[11px] font-semibold ${
                          diff > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        ({diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {/* Barra Orçada */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-slate-400 font-mono">Orçado</span>
                    <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${plannedWidth}%` }}
                      ></div>
                    </div>
                  </div>
                  {/* Barra Realizada */}
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-[10px] text-[#01B8AA] font-mono font-semibold">Realiz.</span>
                    <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          op.isPending
                            ? 'bg-slate-300'
                            : diff > 0
                            ? 'bg-[#EF4444]'
                            : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${op.isPending ? 0 : actualWidth}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
