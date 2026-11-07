/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Product,
  ProductionLog,
  ProductMaterialItem,
  ProductProcessItem,
} from '../../types';
import {
  computeProductComparisonSummary,
  formatBRL,
  formatBRLUnit,
  formatPercent,
  formatSecondsToTime,
  formatHoursToHMin,
} from '../../services/calculator';
import { storage } from '../../services/storage';
import { OperationStatusBadge, ProductStatusBadge } from '../common/Badge';
import { ComparisonCharts } from './ComparisonCharts';
import { ProductFinalReport } from './ProductFinalReport';
import { ActualMaterialModal } from './ActualMaterialModal';
import { ActualProcessModal } from './ActualProcessModal';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  FileText,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Layers,
  Package,
  Edit2,
  Percent,
  DollarSign,
  Receipt,
  Info,
  Cpu,
  Wrench,
} from 'lucide-react';

type SortOption = 'EXCESS_COST' | 'VARIANCE_PCT' | 'EXCESS_TIME' | 'ACTUAL_COST' | 'ORDER';

interface ComparisonViewProps {
  products: Product[];
  logs: ProductionLog[];
  selectedProductId?: string;
  onSelectProduct: (id: string) => void;
  onGoToLogs: (productId: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  products,
  logs,
  selectedProductId,
  onSelectProduct,
  onGoToLogs,
}) => {
  const activeProductId = selectedProductId || products[0]?.id || '';
  const currentProduct = products.find((p) => p.id === activeProductId);

  const [sortOption, setSortOption] = useState<SortOption>('EXCESS_COST');
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Modal para apontamento real de matéria-prima
  const [isMatModalOpen, setIsMatModalOpen] = useState(false);
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState<ProductMaterialItem | null>(null);

  // Modal para apontamento real de processo (Máquinas & Tarefas)
  const [isProcModalOpen, setIsProcModalOpen] = useState(false);
  const [selectedProcessForEdit, setSelectedProcessForEdit] = useState<ProductProcessItem | null>(null);

  if (!currentProduct) {
    return (
      <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
        <BarChart3 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-semibold text-[#374151]">Nenhum produto cadastrado</p>
        <p className="text-xs text-gray-400 mt-1">
          Cadastre produtos e orçamentos para gerar comparativos.
        </p>
      </div>
    );
  }

  const summary = computeProductComparisonSummary(currentProduct, logs);

  // Salvar apontamento real de matéria-prima
  const handleSaveActualMaterial = async (updatedItem: ProductMaterialItem) => {
    const isRevision = !!currentProduct.activeRevision;
    let list = isRevision
      ? [...(currentProduct.activeRevision?.materials || currentProduct.materials || [])]
      : [...(currentProduct.materials || [])];

    const idx = list.findIndex((m) => m.id === updatedItem.id);
    if (idx >= 0) {
      list[idx] = updatedItem;
    } else {
      list.push(updatedItem);
    }

    if (isRevision && currentProduct.activeRevision) {
      const updatedRev = {
        ...currentProduct.activeRevision,
        materials: list,
      };
      const updatedProduct: Product = {
        ...currentProduct,
        materials: list,
        activeRevision: updatedRev,
        revisions: currentProduct.revisions.map((r) =>
          r.revisionNumber === updatedRev.revisionNumber ? updatedRev : r
        ),
      };
      await storage.saveProduct(updatedProduct);
    } else {
      const updatedProduct: Product = {
        ...currentProduct,
        materials: list,
      };
      await storage.saveProduct(updatedProduct);
    }

    // Dispara recarregamento
    onSelectProduct(currentProduct.id);
  };

  // Salvar apontamento real de processo (Máquinas & Tarefas)
  const handleSaveActualProcess = async (updatedItem: ProductProcessItem) => {
    const isRevision = !!currentProduct.activeRevision;
    let list = isRevision
      ? [...(currentProduct.activeRevision?.processos || currentProduct.processos || [])]
      : [...(currentProduct.processos || [])];

    if (list.length === 0) {
      list = [...summary.processos];
    }

    const idx = list.findIndex((p) => p.id === updatedItem.id || p.nome === updatedItem.nome);
    if (idx >= 0) {
      list[idx] = updatedItem;
    } else {
      list.push(updatedItem);
    }

    // Sincroniza também no actualRecord se existir
    let updatedActualRecord = currentProduct.actualRecord;
    if (updatedActualRecord) {
      const actProcessos = [...(updatedActualRecord.processos || [])];
      const actIdx = actProcessos.findIndex((p) => p.id === updatedItem.id || p.nome === updatedItem.nome);
      if (actIdx >= 0) {
        actProcessos[actIdx] = updatedItem;
      } else {
        actProcessos.push(updatedItem);
      }
      updatedActualRecord = {
        ...updatedActualRecord,
        processos: actProcessos,
        totalProcessosReal: actProcessos.reduce((sum, p) => sum + (p.custoTotalReal || 0), 0),
        updatedAt: new Date().toISOString(),
      };
      await storage.saveActualRecord(updatedActualRecord);
    }

    if (isRevision && currentProduct.activeRevision) {
      const updatedRev = {
        ...currentProduct.activeRevision,
        processos: list,
      };
      const updatedProduct: Product = {
        ...currentProduct,
        processos: list,
        activeRevision: updatedRev,
        actualRecord: updatedActualRecord,
        revisions: currentProduct.revisions.map((r) =>
          r.revisionNumber === updatedRev.revisionNumber ? updatedRev : r
        ),
      };
      await storage.saveProduct(updatedProduct);
    } else {
      const updatedProduct: Product = {
        ...currentProduct,
        processos: list,
        actualRecord: updatedActualRecord,
      };
      await storage.saveProduct(updatedProduct);
    }

    onSelectProduct(currentProduct.id);
  };

  // Ordenação de operações
  const sortedOperations = [...summary.operations].sort((a, b) => {
    switch (sortOption) {
      case 'EXCESS_COST':
        return b.financialDifference - a.financialDifference;
      case 'VARIANCE_PCT':
        return (b.financialVariancePercent || 0) - (a.financialVariancePercent || 0);
      case 'EXCESS_TIME':
        return b.timeDifferenceSeconds - a.timeDifferenceSeconds;
      case 'ACTUAL_COST':
        return b.actualTotalCost - a.actualTotalCost;
      case 'ORDER':
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Barra de Seleção de Produto e Ações */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Produto em Análise:
          </label>
          <select
            value={activeProductId}
            onChange={(e) => onSelectProduct(e.target.value)}
            className="w-full md:max-w-md px-3 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white text-[#374151] focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name} ({p.quantity.toLocaleString('pt-BR')} {p.productionUnit})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onGoToLogs(currentProduct.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
          >
            <Clock className="w-4 h-4 text-[#01B8AA]" />
            Apontamento Espelho
          </button>
          <button
            onClick={() => setShowReport(!showReport)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            {showReport ? 'Ver Grade Comparativa' : 'Relatório Executivo Consolidado'}
          </button>
        </div>
      </div>

      {showReport ? (
        <ProductFinalReport summary={summary} product={currentProduct} onBack={() => setShowReport(false)} />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* ZONA DE COMPARATIVO: IMPACTO NA MARGEM DE LUCRO (REQUISITO FUNDAMENTAL) */}
          {/* ========================================================================= */}
          <div
            className={`p-6 rounded-xl border shadow-sm transition-all ${
              summary.profitMarginShrunk
                ? 'bg-red-50/70 border-red-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/60">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    summary.profitMarginShrunk
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-[#10B981] text-white'
                  }`}
                >
                  {summary.profitMarginShrunk ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <TrendingUp className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-base font-bold ${
                        summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                      }`}
                    >
                      {summary.profitMarginShrunk
                        ? 'Alerta de Impacto: Margem de Lucro Encolheu!'
                        : 'Margem de Lucro Preservada ou Superior'}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        summary.profitMarginShrunk
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {summary.profitMarginShrunk ? 'Erosão de Lucro' : 'Meta Atingida'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl">
                    O Valor Final de Venda ({formatBRL(summary.finalTotal)}) e o Valor Markup ({formatBRL(summary.markupValue)}) estão fixos e faturados ao cliente. Cada real de desvio de custo na produção é absorvido diretamente pela margem da gráfica.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Variação da Margem
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {summary.profitMarginDiff > 0
                    ? `+${formatBRL(summary.profitMarginDiff)}`
                    : formatBRL(summary.profitMarginDiff)}
                </span>
                <span
                  className={`text-xs font-bold block ${
                    summary.profitMarginShrunk ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {summary.profitMarginPercentDiff > 0 ? '+' : ''}
                  {summary.profitMarginPercentDiff.toFixed(2)} pontos percentuais
                </span>
              </div>
            </div>

            {/* Grid Comparativo de Margem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {/* Margem Orçada */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Margem de Lucro Prevista
                </span>
                <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                  {formatBRL(summary.plannedProfitMarginValue)}
                </span>
                <span className="text-xs font-bold text-teal-600 font-mono">
                  {summary.plannedProfitMarginPercent.toFixed(2)}% do Markup
                </span>
              </div>

              {/* Margem Realizada Efetiva */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.profitMarginShrunk
                    ? 'bg-red-50/50 border-red-300'
                    : 'bg-emerald-50/50 border-emerald-300'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    summary.profitMarginShrunk ? 'text-red-700' : 'text-emerald-800'
                  }`}
                >
                  Margem de Lucro Realizada
                </span>
                <span
                  className={`text-xl font-black font-mono block mt-1 ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {formatBRL(summary.actualProfitMarginValue)}
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    summary.profitMarginShrunk ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}
                >
                  {summary.actualProfitMarginPercent.toFixed(2)}% do Markup
                </span>
              </div>

              {/* Custo Total Orçado */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Custo Total Previsto (A)
                </span>
                <span className="text-xl font-bold text-gray-700 font-mono block mt-1">
                  {formatBRL(summary.plannedTotalCost)}
                </span>
                <span className="text-[11px] text-gray-400">Insumos + Tarefas</span>
              </div>

              {/* Custo Total Realizado */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.financialDifference > 0
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider block ${
                    summary.financialDifference > 0 ? 'text-red-700 font-bold' : 'text-gray-400'
                  }`}
                >
                  Custo Total Realizado (A)
                </span>
                <span
                  className={`text-xl font-bold font-mono block mt-1 ${
                    summary.financialDifference > 0 ? 'text-[#EF4444]' : 'text-gray-800'
                  }`}
                >
                  {formatBRL(summary.actualTotalCost)}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    summary.financialDifference > 0 ? 'text-[#EF4444]' : 'text-emerald-700'
                  }`}
                >
                  Desvio: {summary.financialDifference > 0 ? `+${formatBRL(summary.financialDifference)}` : formatBRL(summary.financialDifference)}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD DE ALERTA VISUAL: 'VARIAÇÃO DE PRODUÇÃO & PÓS-CÁLCULO DE VOLUME' */}
          {/* ========================================================================= */}
          <div
            className={`p-6 rounded-xl border shadow-sm transition-all ${
              summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                ? 'bg-amber-50/80 border-amber-200'
                : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200/70">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                    summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                      ? 'bg-amber-500 text-white'
                      : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#01B8AA] text-white'
                  }`}
                >
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-[#374151]">
                      Variação de Produção & Custo Unitário (Pós-Cálculo)
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                        summary.productionVolumeAnalysis.tipo === 'EXCEDENTE'
                          ? 'bg-amber-200 text-amber-900'
                          : summary.productionVolumeAnalysis.tipo === 'DEFASAGEM'
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {summary.productionVolumeAnalysis.titulo}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-3xl">
                    {summary.productionVolumeAnalysis.descricao}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Variação de Tiragem
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    summary.quantityVariance > 0
                      ? 'text-amber-700'
                      : summary.quantityVariance < 0
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {summary.quantityVariance > 0
                    ? `+${summary.quantityVariance.toLocaleString('pt-BR')}`
                    : summary.quantityVariance.toLocaleString('pt-BR')}{' '}
                  <span className="text-sm font-bold text-gray-500 uppercase">
                    {currentProduct.productionUnit}
                  </span>
                </span>
                <span className="text-xs font-bold block text-gray-600 font-mono">
                  {summary.quantityVariancePercent !== null && summary.quantityVariancePercent > 0 ? '+' : ''}
                  {summary.quantityVariancePercent !== null ? summary.quantityVariancePercent.toFixed(2) : '0.00'}% da tiragem prevista
                </span>
              </div>
            </div>

            {/* Linha 1: Volume de Produção (Orçado x Entregue) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {/* Quantidade Orçada */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Quantidade Orçada (Proposta)
                  </span>
                  <span className="text-lg font-bold text-gray-800 font-mono block mt-0.5">
                    {summary.plannedQuantity.toLocaleString('pt-BR')} {currentProduct.productionUnit}
                  </span>
                  <span className="text-[10px] text-gray-500">Tiragem contratual fechada com o cliente</span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
              </div>

              {/* Quantidade Realmente Entregue */}
              <div
                className={`p-3.5 rounded-xl border shadow-xs flex items-center justify-between ${
                  summary.quantityVariance !== 0
                    ? 'bg-teal-50/70 border-teal-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold text-[#00897B] uppercase tracking-wider block">
                    Quantidade Realmente Entregue
                  </span>
                  <span className="text-lg font-black text-gray-900 font-mono block mt-0.5">
                    {summary.deliveredQuantity.toLocaleString('pt-BR')} {currentProduct.productionUnit}
                  </span>
                  <span className="text-[10px] font-semibold text-teal-800 font-mono">
                    Variação: {summary.quantityVariance > 0 ? `+${summary.quantityVariance.toLocaleString('pt-BR')}` : summary.quantityVariance.toLocaleString('pt-BR')} un ({summary.quantityVariancePercent !== null && summary.quantityVariancePercent > 0 ? '+' : ''}{summary.quantityVariancePercent?.toFixed(2)}%)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-teal-100/80 flex items-center justify-center text-teal-700 shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Linha 2: As DUAS Visões Claras de Custo Unitário (Sem Impostos vs Com Impostos) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3">
              {/* VISÃO 1: Custo Unitário Direto de Produção (Sem Impostos / Bloco A) */}
              <div className="bg-white p-4 rounded-xl border-2 border-teal-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00897B]"></span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        1. Custo Unitário Direto de Produção
                      </h4>
                      <span className="text-[10px] font-semibold text-[#00897B] font-mono">
                        (Sem Impostos / Bloco A = Custo Total Bloco A / Tiragem)
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    Chão de Fábrica
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Orçado Direto */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      Orçado Direto
                    </span>
                    <span className="text-xl font-bold text-gray-800 font-mono block mt-1">
                      {formatBRLUnit(summary.plannedUnitCostDirect)}
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5 truncate" title={`Bloco A: ${formatBRL(summary.plannedTotalCost)} / ${summary.plannedQuantity.toLocaleString('pt-BR')} un`}>
                      Bloco A ({formatBRL(summary.plannedTotalCost)}) / {summary.plannedQuantity.toLocaleString('pt-BR')} un
                    </span>
                  </div>

                  {/* Realizado Direto */}
                  <div
                    className={`p-3 rounded-lg border ${
                      summary.unitCostDirectVariance > 0
                        ? 'bg-red-50/70 border-red-200'
                        : summary.unitCostDirectVariance < 0
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        summary.unitCostDirectVariance > 0
                          ? 'text-red-700'
                          : summary.unitCostDirectVariance < 0
                          ? 'text-emerald-800'
                          : 'text-gray-500'
                      }`}
                    >
                      Realizado Direto
                    </span>
                    <span
                      className={`text-xl font-black font-mono block mt-1 ${
                        summary.unitCostDirectVariance > 0
                          ? 'text-[#EF4444]'
                          : summary.unitCostDirectVariance < 0
                          ? 'text-[#10B981]'
                          : 'text-gray-900'
                      }`}
                    >
                      {summary.actualUnitCostDirect ? formatBRLUnit(summary.actualUnitCostDirect) : 'Pendente'}
                    </span>
                    <span className="text-[10px] text-gray-600 block mt-0.5 truncate" title={`Bloco A Real: ${formatBRL(summary.actualTotalCost)} / ${summary.deliveredQuantity.toLocaleString('pt-BR')} un`}>
                      Bloco A Real ({formatBRL(summary.actualTotalCost)}) / {summary.deliveredQuantity.toLocaleString('pt-BR')} un
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] font-mono border-t border-gray-100">
                  <span className="text-gray-500 font-medium">Variação Unitária Direta:</span>
                  <span
                    className={`font-bold ${
                      summary.unitCostDirectVariance > 0
                        ? 'text-[#EF4444]'
                        : summary.unitCostDirectVariance < 0
                        ? 'text-[#10B981]'
                        : 'text-gray-700'
                    }`}
                  >
                    {summary.unitCostDirectVariance > 0 ? `+${formatBRLUnit(summary.unitCostDirectVariance)}` : formatBRLUnit(summary.unitCostDirectVariance)}{' '}
                    ({summary.unitCostDirectVariancePercent !== null && summary.unitCostDirectVariancePercent > 0 ? '+' : ''}
                    {summary.unitCostDirectVariancePercent !== null ? summary.unitCostDirectVariancePercent.toFixed(2) : '0.00'}%)
                  </span>
                </div>
              </div>

              {/* VISÃO 2: Custo Unitário Comercial / Total (Com Impostos e Encargos / Valor Final) */}
              <div className="bg-white p-4 rounded-xl border-2 border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        2. Custo / Preço Comercial Total
                      </h4>
                      <span className="text-[10px] font-semibold text-indigo-700 font-mono">
                        (Com Impostos e Encargos = Valor Final da Venda / Tiragem)
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                    Comercial & Tributos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Orçado Comercial */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      Orçado Comercial
                    </span>
                    <span className="text-xl font-bold text-gray-800 font-mono block mt-1">
                      {formatBRLUnit(summary.plannedUnitCostCommercial)}
                    </span>
                    <span className="text-[10px] text-gray-500 block mt-0.5 truncate" title={`Total Proposta: ${formatBRL(summary.finalTotal)} / ${summary.plannedQuantity.toLocaleString('pt-BR')} un`}>
                      Total Proposta ({formatBRL(summary.finalTotal)}) / {summary.plannedQuantity.toLocaleString('pt-BR')} un
                    </span>
                  </div>

                  {/* Realizado Comercial */}
                  <div
                    className={`p-3 rounded-lg border ${
                      summary.unitCostCommercialVariance > 0
                        ? 'bg-amber-50/70 border-amber-200'
                        : summary.unitCostCommercialVariance < 0
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        summary.unitCostCommercialVariance > 0
                          ? 'text-amber-800'
                          : summary.unitCostCommercialVariance < 0
                          ? 'text-emerald-800'
                          : 'text-gray-500'
                      }`}
                    >
                      Realizado Comercial
                    </span>
                    <span
                      className={`text-xl font-black font-mono block mt-1 ${
                        summary.unitCostCommercialVariance > 0
                          ? 'text-amber-800'
                          : summary.unitCostCommercialVariance < 0
                          ? 'text-[#10B981]'
                          : 'text-gray-900'
                      }`}
                    >
                      {summary.actualUnitCostCommercial ? formatBRLUnit(summary.actualUnitCostCommercial) : 'Pendente'}
                    </span>
                    <span className="text-[10px] text-gray-600 block mt-0.5 truncate" title={`Custo Real + Tributos: ${formatBRL(summary.actualTotalWithTaxes)} / ${summary.deliveredQuantity.toLocaleString('pt-BR')} un`}>
                      Custo Real + Tributos ({formatBRL(summary.actualTotalWithTaxes)}) / {summary.deliveredQuantity.toLocaleString('pt-BR')} un
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] font-mono border-t border-gray-100">
                  <span className="text-gray-500 font-medium">Variação Unitária Comercial:</span>
                  <span
                    className={`font-bold ${
                      summary.unitCostCommercialVariance > 0
                        ? 'text-amber-800'
                        : summary.unitCostCommercialVariance < 0
                        ? 'text-[#10B981]'
                        : 'text-gray-700'
                    }`}
                  >
                    {summary.unitCostCommercialVariance > 0 ? `+${formatBRLUnit(summary.unitCostCommercialVariance)}` : formatBRLUnit(summary.unitCostCommercialVariance)}{' '}
                    ({summary.unitCostCommercialVariancePercent !== null && summary.unitCostCommercialVariancePercent > 0 ? '+' : ''}
                    {summary.unitCostCommercialVariancePercent !== null ? summary.unitCostCommercialVariancePercent.toFixed(2) : '0.00'}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Painel Narrativo: Diagnóstico de Diluição e Reflexo na Margem */}
            <div className="mt-4 pt-4 border-t border-gray-200/70 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white/80 rounded-lg border border-gray-200/80">
                <span className="font-bold text-gray-700 block uppercase text-[10px] tracking-wide mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#01B8AA]" />
                  Diluição / Concentração de Custos
                </span>
                <p className="text-gray-600 leading-relaxed">
                  {summary.productionVolumeAnalysis.diluicao}
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  summary.profitMarginShrunk
                    ? 'bg-red-50/80 border-red-200 text-red-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}
              >
                <span className="font-bold block uppercase text-[10px] tracking-wide mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  Reflexo no Preço Faturado e na Margem Real
                </span>
                <p className="leading-relaxed">
                  {summary.productionVolumeAnalysis.impactoMargem}
                </p>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LINHA 1: INDICADORES GERAIS (LINHA HORIZONTAL COMPLETA DEDICADA) */}
          {/* ========================================================================= */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              Linha 1 · Indicadores Gerais de Custo
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Custo Orçado Total */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Custo Orçado Total
                </span>
                <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                  {formatBRL(summary.plannedTotalCost)}
                </span>
                <span className="text-[11px] text-gray-400">Previsto em orçamento</span>
              </div>

              {/* 2. Custo Realizado Total */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Custo Realizado Total
                </span>
                <span className="text-xl font-bold text-[#374151] font-mono block mt-1">
                  {formatBRL(summary.actualTotalCost)}
                </span>
                <span className="text-[11px] text-gray-500">
                  {summary.pendingOperations > 0
                    ? `${summary.pendingOperations} etapa(s) pendente(s)`
                    : 'Todas etapas apontadas'}
                </span>
              </div>

              {/* 3. Saldo de Desvio */}
              <div
                className={`p-4 rounded-xl border shadow-xs ${
                  summary.financialDifference > 0
                    ? 'bg-red-50/70 border-red-200'
                    : summary.financialDifference < 0
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span className={summary.financialDifference > 0 ? 'text-red-900' : 'text-emerald-900'}>
                    Saldo de Desvio
                  </span>
                  {summary.financialDifference > 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#EF4444]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#10B981]" />
                  )}
                </div>
                <span
                  className={`text-xl font-bold font-mono block mt-1 ${
                    summary.financialDifference > 0
                      ? 'text-[#EF4444]'
                      : summary.financialDifference < 0
                      ? 'text-[#10B981]'
                      : 'text-gray-900'
                  }`}
                >
                  {summary.financialDifference > 0
                    ? `+${formatBRL(summary.financialDifference)}`
                    : formatBRL(summary.financialDifference)}
                </span>
                <span
                  className={`text-[11px] font-semibold font-mono ${
                    summary.financialDifference > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {formatPercent(summary.financialVariancePercent)}
                </span>
              </div>

              {/* 4. Excedentes e Economias */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Excedentes e Economias
                </span>
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className="text-red-700 font-semibold font-mono">
                    Excedente: +{formatBRL(summary.totalCostOverruns)}
                  </div>
                  <div className="text-emerald-700 font-semibold font-mono">
                    Economia: -{formatBRL(summary.totalCostSavings)}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 block mt-1">Valores brutos separados</span>
              </div>

              {/* 5. Custo Unitário */}
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Custo Unitário</span>
                  <span className="text-[10px] text-teal-300 font-mono">
                    {summary.deliveredQuantity.toLocaleString('pt-BR')} un
                  </span>
                </div>
                <span className="text-xl font-bold text-white font-mono block mt-1">
                  {summary.actualUnitCost ? formatBRLUnit(summary.actualUnitCost) : 'Pendente'}
                </span>
                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                  <span>Orçado: {formatBRLUnit(summary.plannedUnitCost)}</span>
                  <span
                    className={`font-bold ${
                      summary.unitCostVariance > 0 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {summary.unitCostVariance > 0 ? '+' : ''}
                    {summary.unitCostVariancePercent?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos Comparativos Orçado x Realizado */}
          <ComparisonCharts summary={summary} />

          {/* ========================================================================= */}
          {/* TABELA COMPARATIVA DE MATÉRIAS-PRIMAS DO BLOCO A */}
          {/* ========================================================================= */}
          {summary.materials.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#01B8AA]" />
                  <h3 className="text-sm font-bold text-[#374151]">
                    Comparativo de Matérias-Primas (Bloco A)
                  </h3>
                </div>
                <div className="text-xs text-gray-500">
                  Total Orçado: <strong className="font-mono text-gray-800">{formatBRL(summary.plannedMaterialsCost)}</strong> · Real: <strong className="font-mono text-gray-800">{formatBRL(summary.actualMaterialsCost)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#374151]">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Insumo</th>
                      <th className="py-2.5 px-4 text-right">Qtd. Orçada</th>
                      <th className="py-2.5 px-4 text-right">Qtd. Real Consumida</th>
                      <th className="py-2.5 px-4 text-right">Custo Unit. Orçado (R$)</th>
                      <th className="py-2.5 px-4 text-right">Custo Unitário Realizado (R$)</th>
                      <th className="py-2.5 px-4 text-right">Custo Orçado (R$)</th>
                      <th className="py-2.5 px-4 text-right">Custo Real (R$)</th>
                      <th className="py-2.5 px-4 text-right">Desvio (R$)</th>
                      <th className="py-2.5 px-4 text-center w-28">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.materials.map((mat, mIdx) => {
                      const realQty = mat.quantidadeReal !== undefined ? mat.quantidadeReal : mat.quantidade;
                      const realUnitCost =
                        mat.custoUnitarioReal !== undefined
                          ? mat.custoUnitarioReal
                          : (realQty > 0 && mat.totalCustoReal !== undefined
                              ? (mat.totalCustoReal / realQty)
                              : mat.custoUnitario);
                      const realTotal =
                        mat.totalCustoReal !== undefined
                          ? mat.totalCustoReal
                          : (realQty * realUnitCost);
                      const diff = Number((realTotal - mat.totalCusto).toFixed(2));

                      return (
                        <tr key={`comp_mat_${mat.id || mIdx}_${mIdx}`} className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-gray-800">{mat.nome}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-700">
                            {mat.quantidade.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">
                            {realQty.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                            {formatBRLUnit(mat.custoUnitario)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-700">
                            {formatBRLUnit(realUnitCost)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-gray-700">
                            {formatBRL(mat.totalCusto)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00897B]">
                            {formatBRL(realTotal)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">
                            <span className={diff > 0 ? 'text-[#EF4444]' : diff < 0 ? 'text-[#10B981]' : 'text-gray-500'}>
                              {diff > 0 ? `+${formatBRL(diff)}` : formatBRL(diff)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedMaterialForEdit(mat);
                                setIsMatModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#00897B] bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                              Apontar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TABELA COMPARATIVA DETALHADA POR OPERAÇÃO */}
          {/* ========================================================================= */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#01B8AA]" />
                  <h3 className="text-sm font-bold text-[#374151]">
                    Máquinas & Equipamentos (Orçado x Realizado)
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Análise comparativa detalhada de custos por hora e milheiro executados no parque fabril.
                </p>
              </div>

              {/* Indicador de itens */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                  {summary.processos.length} {summary.processos.length === 1 ? 'item vinculado' : 'itens vinculados'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#374151]">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Máquina / Tarefa</th>
                    <th className="py-3 px-4">Cobrança</th>
                    <th className="py-3 px-4 text-right">Orçado</th>
                    <th className="py-3 px-4 text-right">Realizado</th>
                    <th className="py-3 px-4 text-right">Diferença (R$)</th>
                    <th className="py-3 px-4 text-right">Variação %</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.processos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-gray-400">
                        Nenhuma máquina ou tarefa vinculada neste orçamento.
                      </td>
                    </tr>
                  ) : (
                    summary.processos.map((proc, pIdx) => {
                      const isHora = proc.tipoCobranca === 'HORA';
                      const orçadoCost = proc.custoTotal || 0;
                      const realCost = proc.custoTotalReal ?? orçadoCost;
                      const diff = Number((realCost - orçadoCost).toFixed(2));
                      const isOverBudget = diff > 0;
                      const isUnderBudget = diff < 0;
                      const varPct = orçadoCost > 0 ? (diff / orçadoCost) * 100 : 0;

                      return (
                        <tr
                          key={`comp_proc_${proc.id || pIdx}_${pIdx}`}
                          className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors"
                        >
                          {/* Ordem */}
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-400">
                            #{proc.order || pIdx + 1}
                          </td>

                          {/* Tipo: Máquina / Tarefa */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                proc.tipoItem === 'MAQUINA'
                                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              }`}
                            >
                              {proc.tipoItem === 'MAQUINA' ? (
                                <Cpu className="w-3 h-3 text-teal-600" />
                              ) : (
                                <Wrench className="w-3 h-3 text-indigo-600" />
                              )}
                              <span>{proc.tipoItem === 'MAQUINA' ? 'Máquina' : 'Tarefa'}</span>
                            </span>
                          </td>

                          {/* Nome e Descrição */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{proc.nome}</div>
                            {proc.descricao && (
                              <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                {proc.descricao}
                              </div>
                            )}
                            {proc.realizadoNotas && (
                              <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block">
                                Obs: {proc.realizadoNotas}
                              </div>
                            )}
                          </td>

                          {/* Tipo de Cobrança */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {isHora ? <Clock className="w-3 h-3 text-slate-500" /> : <Coins className="w-3 h-3 text-slate-500" />}
                              <span>{isHora ? 'Por Hora' : 'Por Milheiro'}</span>
                            </span>
                          </td>

                          {/* Orçado */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <div className="font-bold text-gray-900">{formatBRL(orçadoCost)}</div>
                            <div className="text-[11px] text-gray-500">
                              {isHora
                                ? `${formatHoursToHMin(proc.tempoPrevistoHoras)} (${proc.tempoPrevistoHoras.toFixed(2)}h) @ ${formatBRL(proc.custoHora)}/h`
                                : `${proc.quantidadeProducao.toLocaleString('pt-BR')} un @ ${formatBRL(proc.custoMilheiro)}/mil`}
                            </div>
                            {isHora && (proc.tempoProdutivoHoras !== undefined || proc.tempoAcertoHoras !== undefined || proc.tempoExtraHoras !== undefined) && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                P: {formatHoursToHMin(proc.tempoProdutivoHoras)} · A: {formatHoursToHMin(proc.tempoAcertoHoras)} · E: {formatHoursToHMin(proc.tempoExtraHoras)}
                              </div>
                            )}
                          </td>

                          {/* Realizado */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <div className="font-bold text-[#00897B]">{formatBRL(realCost)}</div>
                            <div className="text-[11px] text-gray-500">
                              {isHora
                                ? `${formatHoursToHMin(proc.tempoRealHoras ?? proc.tempoPrevistoHoras)} (${(proc.tempoRealHoras ?? proc.tempoPrevistoHoras).toFixed(2)}h) @ ${formatBRL(proc.custoHoraReal ?? proc.custoHora)}/h`
                                : `${(proc.quantidadeReal ?? proc.quantidadeProducao).toLocaleString('pt-BR')} un @ ${formatBRL(proc.custoMilheiroReal ?? proc.custoMilheiro)}/mil`}
                            </div>
                            {isHora && (proc.tempoProdutivoRealHoras !== undefined || proc.tempoAcertoRealHoras !== undefined || proc.tempoExtraRealHoras !== undefined) && (
                              <div className="text-[10px] text-teal-600 mt-0.5">
                                P: {formatHoursToHMin(proc.tempoProdutivoRealHoras)} · A: {formatHoursToHMin(proc.tempoAcertoRealHoras)} · E: {formatHoursToHMin(proc.tempoExtraRealHoras)}
                              </div>
                            )}
                          </td>

                          {/* Diferença Financeira */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold">
                            <span
                              className={
                                isOverBudget
                                  ? 'text-[#EF4444]'
                                  : isUnderBudget
                                  ? 'text-[#10B981]'
                                  : 'text-gray-700'
                              }
                            >
                              {diff > 0 ? `+${formatBRL(diff)}` : diff < 0 ? formatBRL(diff) : 'R$ 0,00'}
                            </span>
                          </td>

                          {/* Variação Percentual */}
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                            <span
                              className={
                                isOverBudget
                                  ? 'text-[#EF4444]'
                                  : isUnderBudget
                                  ? 'text-[#10B981]'
                                  : 'text-gray-500'
                              }
                            >
                              {varPct !== 0 ? formatPercent(varPct) : '0,00%'}
                            </span>
                          </td>

                          {/* Ações / Apontar Real */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedProcessForEdit(proc);
                                setIsProcModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#00897B] bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 rounded-lg transition-colors"
                              title="Apontar valor real deste processo produtivo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Apontar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {summary.processos.length > 0 && (
                  <tfoot className="bg-gray-50/90 border-t-2 border-gray-200 font-bold text-xs">
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-gray-700 uppercase tracking-wide">
                        Total Máquinas & Tarefas Produtivas:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {formatBRL(summary.plannedProcessosCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#00897B]">
                        {formatBRL(summary.actualProcessosCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span
                          className={
                            summary.actualProcessosCost > summary.plannedProcessosCost
                              ? 'text-[#EF4444]'
                              : summary.actualProcessosCost < summary.plannedProcessosCost
                              ? 'text-[#10B981]'
                              : 'text-gray-700'
                          }
                        >
                          {summary.actualProcessosCost > summary.plannedProcessosCost
                            ? `+${formatBRL(summary.actualProcessosCost - summary.plannedProcessosCost)}`
                            : formatBRL(summary.actualProcessosCost - summary.plannedProcessosCost)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {summary.plannedProcessosCost > 0
                          ? formatPercent(
                              ((summary.actualProcessosCost - summary.plannedProcessosCost) /
                                summary.plannedProcessosCost) *
                                100
                            )
                          : '0,00%'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Apontamento Real de Matéria-Prima */}
      <ActualMaterialModal
        isOpen={isMatModalOpen}
        onClose={() => {
          setIsMatModalOpen(false);
          setSelectedMaterialForEdit(null);
        }}
        materialItem={selectedMaterialForEdit}
        onSave={handleSaveActualMaterial}
      />

      {/* Modal de Apontamento Real de Máquinas & Tarefas Produtivas */}
      <ActualProcessModal
        isOpen={isProcModalOpen}
        onClose={() => {
          setIsProcModalOpen(false);
          setSelectedProcessForEdit(null);
        }}
        processItem={selectedProcessForEdit}
        onSave={handleSaveActualProcess}
      />
    </div>
  );
};
