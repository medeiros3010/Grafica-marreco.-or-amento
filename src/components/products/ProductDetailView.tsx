/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Product,
  ProductOperation,
  StandardTask,
  BudgetRevision,
  ProductStatus,
  ProductMaterialItem,
  ProductPricing,
  DEFAULT_PRODUCT_PRICING,
} from '../../types';
import {
  formatBRL,
  formatBRLUnit,
  formatSecondsToTime,
  calculateMarkupAndPricing,
} from '../../services/calculator';
import { ProductStatusBadge } from '../common/Badge';
import { AddOperationModal } from './AddOperationModal';
import { AddMaterialModal } from './AddMaterialModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  FileCheck,
  History,
  Play,
  CheckCircle2,
  AlertCircle,
  Layers,
  Clock,
  Coins,
  Package,
  Calculator,
  Percent,
  Receipt,
  Save,
  Info,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  standardTasks: StandardTask[];
  onBack: () => void;
  onRefresh: () => void;
  onGoToLogs: (productId: string) => void;
  onGoToAnalysis: (productId: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  standardTasks,
  onBack,
  onRefresh,
  onGoToLogs,
  onGoToAnalysis,
}) => {
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);

  // Modais de operação (Tarefas / Processos)
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<ProductOperation | null>(null);
  const [deleteOpConfirmOpen, setDeleteOpConfirmOpen] = useState(false);
  const [opToDelete, setOpToDelete] = useState<string | null>(null);

  // Modais de Matéria-Prima (Bloco A)
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ProductMaterialItem | null>(null);
  const [deleteMatConfirmOpen, setDeleteMatConfirmOpen] = useState(false);
  const [matToDelete, setMatToDelete] = useState<string | null>(null);

  // Seleção de revisão histórica para consulta
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number>(
    product.currentRevisionNumber || 1
  );

  // Estado local para os parâmetros de precificação dos Blocos B e C
  const activePricingConfig: ProductPricing =
    product.activeRevision?.pricing || product.pricing || DEFAULT_PRODUCT_PRICING;

  const [pricingForm, setPricingForm] = useState<ProductPricing>(activePricingConfig);
  const [pricingDirty, setPricingDirty] = useState(false);

  useEffect(() => {
    const config = product.activeRevision?.pricing || product.pricing || DEFAULT_PRODUCT_PRICING;
    setPricingForm(config);
    setPricingDirty(false);
  }, [product.id, product.pricing, product.activeRevision]);

  const isDraftMode = product.status === 'RASCUNHO' || !product.activeRevision;
  const currentRevision = product.revisions.find(
    (r) => r.revisionNumber === selectedRevisionNumber
  ) || product.activeRevision;

  // Operações e Matérias-Primas do Bloco A
  const displayedOperations = isDraftMode
    ? product.draftOperations || []
    : currentRevision?.operations || product.draftOperations || [];

  const displayedMaterials: ProductMaterialItem[] = isDraftMode
    ? product.materials || []
    : currentRevision?.materials || product.materials || [];

  // ==========================================
  // BLOCO A: CUSTOS (MATÉRIA-PRIMA + TAREFAS)
  // ==========================================
  // 1. Subtotal Matérias-Primas
  const subtotalMateriais = displayedMaterials.reduce((sum, m) => sum + (m.totalCusto || 0), 0);

  // 2. Subtotal Tarefas / Processos
  const taskTotals = displayedOperations.reduce(
    (acc, op) => {
      acc.totalSetupSeconds += op.plannedSetupSeconds;
      acc.totalProductionSeconds += op.plannedProductionSeconds;
      acc.totalTimeSeconds += op.plannedTotalSeconds;
      acc.totalLaborHours += op.plannedLaborHours;
      acc.totalMachineHours += op.plannedMachineHours;
      acc.totalLaborCost += op.plannedLaborCost;
      acc.totalMachineCost += op.plannedMachineCost;
      acc.totalOpMaterialCost += op.materialPlannedCost;
      acc.totalTaskCost += op.plannedTotalCost;
      return acc;
    },
    {
      totalSetupSeconds: 0,
      totalProductionSeconds: 0,
      totalTimeSeconds: 0,
      totalLaborHours: 0,
      totalMachineHours: 0,
      totalLaborCost: 0,
      totalMachineCost: 0,
      totalOpMaterialCost: 0,
      totalTaskCost: 0,
    }
  );

  const subtotalTarefas = taskTotals.totalTaskCost;

  // CUSTO TOTAL (Matéria Prima + Tarefas)
  const custoTotalBlocoA = Number((subtotalMateriais + subtotalTarefas).toFixed(2));
  const custoUnitarioBlocoA =
    product.quantity > 0 ? Number((custoTotalBlocoA / product.quantity).toFixed(4)) : 0;

  // ==========================================
  // BLOCOS B E C: FORMAÇÃO DE PREÇO E VALOR FINAL
  // ==========================================
  const calculatedPricing = calculateMarkupAndPricing(
    custoTotalBlocoA,
    pricingForm,
    product.quantity
  );

  // Handlers para Matéria-Prima
  const handleSaveMaterial = async (materialItem: ProductMaterialItem) => {
    let list = [...(product.materials || [])];
    const idx = list.findIndex((m) => m.id === materialItem.id);
    if (idx >= 0) {
      list[idx] = materialItem;
    } else {
      list.push(materialItem);
    }

    const updated: Product = {
      ...product,
      materials: list,
    };
    await storage.saveProduct(updated);
    onRefresh();
  };

  const handleConfirmDeleteMaterial = async () => {
    if (!matToDelete) return;
    const list = (product.materials || []).filter((m) => m.id !== matToDelete);
    const updated: Product = {
      ...product,
      materials: list,
    };
    await storage.saveProduct(updated);
    setMatToDelete(null);
    setDeleteMatConfirmOpen(false);
    onRefresh();
  };

  // Handlers para Operações / Tarefas
  const handleSaveOperation = async (operation: ProductOperation) => {
    let updatedOperations = [...(product.draftOperations || [])];
    const existingIndex = updatedOperations.findIndex((o) => o.id === operation.id);

    if (existingIndex >= 0) {
      updatedOperations[existingIndex] = operation;
    } else {
      updatedOperations.push(operation);
    }

    updatedOperations = updatedOperations.map((op, idx) => ({
      ...op,
      order: idx + 1,
    }));

    const updatedProduct: Product = {
      ...product,
      draftOperations: updatedOperations,
    };

    await storage.saveProduct(updatedProduct);
    onRefresh();
  };

  const handleConfirmDeleteOp = async () => {
    if (!opToDelete) return;
    const filtered = (product.draftOperations || [])
      .filter((o) => o.id !== opToDelete)
      .map((op, idx) => ({ ...op, order: idx + 1 }));

    const updatedProduct: Product = {
      ...product,
      draftOperations: filtered,
    };

    await storage.saveProduct(updatedProduct);
    setOpToDelete(null);
    setDeleteOpConfirmOpen(false);
    onRefresh();
  };

  const handleMoveOperation = async (index: number, direction: 'UP' | 'DOWN') => {
    const list = [...(product.draftOperations || [])];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((op, idx) => ({ ...op, order: idx + 1 }));
    await storage.saveProduct({
      ...product,
      draftOperations: reordered,
    });
    onRefresh();
  };

  // Salvar Parâmetros de Precificação (Blocos B e C)
  const handleSavePricingConfig = async () => {
    const updated: Product = {
      ...product,
      pricing: pricingForm,
    };
    await storage.saveProduct(updated);
    setPricingDirty(false);
    onRefresh();
  };

  // APROVAÇÃO DO ORÇAMENTO (CONGELA SNAPSHOT)
  const handleApproveBudget = async () => {
    if ((product.draftOperations || []).length === 0 && (product.materials || []).length === 0) {
      alert('Adicione pelo menos uma matéria-prima ou tarefa antes de aprovar o orçamento.');
      return;
    }

    const nextRevNum = (product.revisions?.length || 0) + 1;
    const frozenRevision: BudgetRevision = {
      revisionNumber: nextRevNum,
      approvedAt: new Date().toISOString(),
      approvedBy: 'Usuário do Sistema',
      notes: `Orçamento aprovado com ${(product.materials || []).length} insumos e ${(product.draftOperations || []).length} etapas.`,
      productQuantity: product.quantity,
      operations: JSON.parse(JSON.stringify(product.draftOperations || [])),
      materials: JSON.parse(JSON.stringify(product.materials || [])),
      pricing: JSON.parse(JSON.stringify(pricingForm)),
      totalSetupSeconds: taskTotals.totalSetupSeconds,
      totalProductionSeconds: taskTotals.totalProductionSeconds,
      totalTimeSeconds: taskTotals.totalTimeSeconds,
      totalLaborHours: Number(taskTotals.totalLaborHours.toFixed(4)),
      totalMachineHours: Number(taskTotals.totalMachineHours.toFixed(4)),
      totalLaborCost: Number(taskTotals.totalLaborCost.toFixed(2)),
      totalMachineCost: Number(taskTotals.totalMachineCost.toFixed(2)),
      totalMaterialCost: Number(subtotalMateriais.toFixed(2)),
      totalTasksCost: Number(subtotalTarefas.toFixed(2)),
      totalCost: Number(custoTotalBlocoA.toFixed(2)),
      unitCost: Number(custoUnitarioBlocoA.toFixed(4)),
      markupValue: calculatedPricing.markupValue,
      profitMarginValue: calculatedPricing.profitMarginValue,
      commissionValue: calculatedPricing.commissionValue,
      taxValue: calculatedPricing.taxValue,
      interestValue: calculatedPricing.interestValue,
      ipiValue: calculatedPricing.ipiValue,
      icmsStValue: calculatedPricing.icmsStValue,
      finalTotal: calculatedPricing.finalTotal,
      finalUnitCost: calculatedPricing.finalUnitCost,
    };

    const updatedProduct: Product = {
      ...product,
      status: 'APROVADO',
      currentRevisionNumber: nextRevNum,
      revisions: [...(product.revisions || []), frozenRevision],
      activeRevision: frozenRevision,
      pricing: pricingForm,
    };

    await storage.saveProduct(updatedProduct);
    setSelectedRevisionNumber(nextRevNum);
    setPricingDirty(false);
    onRefresh();
  };

  // CRIAR NOVA REVISÃO
  const handleCreateNewRevision = async () => {
    if (
      !window.confirm(
        'Deseja criar uma nova revisão para este orçamento? A versão atual aprovada permanecerá arquivada no histórico para auditoria e comparações.'
      )
    ) {
      return;
    }

    const draftOps = currentRevision
      ? JSON.parse(JSON.stringify(currentRevision.operations))
      : product.draftOperations;
    const draftMats = currentRevision?.materials
      ? JSON.parse(JSON.stringify(currentRevision.materials))
      : product.materials;
    const draftPricing = currentRevision?.pricing || product.pricing || DEFAULT_PRODUCT_PRICING;

    const updatedProduct: Product = {
      ...product,
      status: 'RASCUNHO',
      draftOperations: draftOps,
      materials: draftMats,
      pricing: draftPricing,
    };

    await storage.saveProduct(updatedProduct);
    onRefresh();
  };

  const handleStatusChange = async (newStatus: ProductStatus) => {
    await storage.saveProduct({
      ...product,
      status: newStatus,
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Barra de Navegação Superior do Produto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Voltar à lista de produtos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sm text-gray-500">{product.code}</span>
              <h2 className="text-lg font-bold text-[#374151] tracking-tight">{product.name}</h2>
              <ProductStatusBadge status={product.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              {product.client && <span>Cliente: <strong>{product.client}</strong></span>}
              <span>·</span>
              <span>Tiragem: <strong>{product.quantity.toLocaleString('pt-BR')} {product.productionUnit}</strong></span>
              <span>·</span>
              <span>Orçado em: {new Date(product.budgetDate).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onGoToLogs(product.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4 text-[#01B8AA]" />
            Apontamento Espelho
          </button>
          <button
            onClick={() => onGoToAnalysis(product.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
          >
            <Coins className="w-4 h-4" />
            Ver Comparativo Orçado x Realizado
          </button>
        </div>
      </div>

      {/* Alerta de Modo de Edição / Congelamento de Revisão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-white border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          {isDraftMode ? (
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#374151]">
                {isDraftMode
                  ? 'Orçamento em Modo Rascunho / Edição Aberta'
                  : `Revisão Oficial Aprovada nº ${selectedRevisionNumber}`}
              </span>
              {currentRevision && !isDraftMode && (
                <span className="text-[11px] text-gray-500 tabular-nums">
                  (Aprovado em {new Date(currentRevision.approvedAt).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(currentRevision.approvedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })})
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isDraftMode
                ? 'Defina insumos, processos produtivos e tributações nos 3 blocos abaixo antes de aprovar.'
                : 'Esta versão teve seus parâmetros e custos congelados. Alterações em tarefas ou insumos centrais não afetam este histórico.'}
            </p>
          </div>
        </div>

        {/* Controles de Versão / Aprovação */}
        <div className="flex items-center gap-2 shrink-0">
          {product.revisions && product.revisions.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <History className="w-4 h-4 text-gray-400" />
              <select
                value={selectedRevisionNumber}
                onChange={(e) => setSelectedRevisionNumber(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
              >
                {product.revisions.map((rev) => (
                  <option key={rev.revisionNumber} value={rev.revisionNumber}>
                    Revisão {rev.revisionNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isDraftMode ? (
            <button
              onClick={handleApproveBudget}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg shadow-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar Versão do Orçamento
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {product.status === 'APROVADO' && (
                <button
                  onClick={() => handleStatusChange('EM_PRODUCAO')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Iniciar Produção
                </button>
              )}
              {product.status === 'EM_PRODUCAO' && (
                <button
                  onClick={() => handleStatusChange('CONCLUIDO')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Concluir Produto
                </button>
              )}
              <button
                onClick={handleCreateNewRevision}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                Criar Nova Revisão
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BLOCO A: CUSTOS (MATÉRIA-PRIMA + TAREFAS / PROCESSOS) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm space-y-6 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#01B8AA] text-white font-bold text-xs flex items-center justify-center">
              A
            </span>
            <div>
              <h3 className="text-base font-bold text-[#374151]">
                Bloco A: Custos (Matéria Prima + Tarefas)
              </h3>
              <p className="text-xs text-gray-500">
                Levantamento detalhado dos insumos e das horas produtivas e de acerto.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Custo Total Bloco A
              </span>
              <span className="text-xl font-bold text-[#00897B] font-mono">
                {formatBRL(custoTotalBlocoA)}
              </span>
              <span className="text-[11px] text-gray-500 block">
                ({formatBRLUnit(custoUnitarioBlocoA)} / {product.productionUnit})
              </span>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO DE MATÉRIAS-PRIMAS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#01B8AA]" />
              <h4 className="text-sm font-bold text-[#374151]">Matérias-Primas (Insumos)</h4>
              <span className="text-xs text-gray-400">
                ({displayedMaterials.length} {displayedMaterials.length === 1 ? 'item' : 'itens'})
              </span>
            </div>
            {isDraftMode && (
              <button
                onClick={() => {
                  setEditingMaterial(null);
                  setIsMaterialModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Matéria-Prima
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Insumo / Matéria-Prima</th>
                  <th className="py-2.5 px-4 text-center">Unidade</th>
                  <th className="py-2.5 px-4 text-right">Quantidade</th>
                  <th className="py-2.5 px-4 text-right">Custo Unitário (R$)</th>
                  <th className="py-2.5 px-4 text-right font-bold text-gray-800">Total (R$)</th>
                  {isDraftMode && <th className="py-2.5 px-4 text-right w-24">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={isDraftMode ? 6 : 5} className="py-6 text-center text-gray-400">
                      Nenhuma matéria-prima adicionada neste bloco.
                    </td>
                  </tr>
                ) : (
                  displayedMaterials.map((mat) => (
                    <tr key={mat.id} className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-gray-800">{mat.nome}</td>
                      <td className="py-2.5 px-4 text-center text-gray-600 font-mono">{mat.unidade}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium">
                        {mat.quantidade.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                        {formatBRLUnit(mat.custoUnitario)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00897B]">
                        {formatBRL(mat.totalCusto)}
                      </td>
                      {isDraftMode && (
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingMaterial(mat);
                                setIsMaterialModalOpen(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar Insumo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setMatToDelete(mat.id);
                                setDeleteMatConfirmOpen(true);
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Excluir Insumo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-xs">
                <tr>
                  <td colSpan={4} className="py-2 px-4 text-right text-gray-600 uppercase tracking-wider text-[11px]">
                    Subtotal Matérias-Primas:
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-[#00897B] font-mono">
                    {formatBRL(subtotalMateriais)}
                  </td>
                  {isDraftMode && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 2. SEÇÃO DE TAREFAS / PROCESSOS */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#01B8AA]" />
              <h4 className="text-sm font-bold text-[#374151]">Tarefas & Processos Produtivos</h4>
              <span className="text-xs text-gray-400">
                ({displayedOperations.length} {displayedOperations.length === 1 ? 'etapa' : 'etapas'})
              </span>
            </div>
            {isDraftMode && (
              <button
                onClick={() => {
                  setEditingOp(null);
                  setIsOpModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Tarefa
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-4">Operação & Máquina</th>
                  <th className="py-2.5 px-4 text-right">Tempo Acerto</th>
                  <th className="py-2.5 px-4 text-right">Tempo Prod.</th>
                  <th className="py-2.5 px-4 text-right">Tempo Total</th>
                  <th className="py-2.5 px-4 text-right">Custo Máq/h</th>
                  <th className="py-2.5 px-4 text-right font-bold text-gray-800">Total (R$)</th>
                  <th className="py-2.5 px-4 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedOperations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      Nenhuma tarefa/operação cadastrada neste orçamento.
                    </td>
                  </tr>
                ) : (
                  displayedOperations.map((op, idx) => {
                    const isExpanded = expandedOpId === op.id;
                    const totalHours = (op.plannedSetupSeconds + op.plannedProductionSeconds) / 3600;

                    return (
                      <React.Fragment key={op.id}>
                        <tr className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-gray-400">
                            {isDraftMode ? (
                              <div className="flex flex-col items-center">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMoveOperation(idx, 'UP')}
                                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs text-gray-700">{op.order}</span>
                                <button
                                  disabled={idx === displayedOperations.length - 1}
                                  onClick={() => handleMoveOperation(idx, 'DOWN')}
                                  className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span>{op.order}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-gray-800">{op.name}</div>
                            <div className="text-[11px] text-gray-500">{op.machine || 'Sem máquina vinculada'}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                            {formatSecondsToTime(op.plannedSetupSeconds)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                            {formatSecondsToTime(op.plannedProductionSeconds)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-gray-800">
                            {formatSecondsToTime(op.plannedTotalSeconds)} ({totalHours.toFixed(2)}h)
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-gray-600">
                            {formatBRL(op.hourlyMachineRate)}/h
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00897B]">
                            {formatBRL(op.plannedTotalCost)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setExpandedOpId(isExpanded ? null : op.id)}
                                title="Expandir Detalhes"
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {isDraftMode && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingOp(op);
                                      setIsOpModalOpen(true);
                                    }}
                                    title="Editar Tarefa"
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpToDelete(op.id);
                                      setDeleteOpConfirmOpen(true);
                                    }}
                                    title="Excluir Tarefa"
                                    className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50 border-b border-gray-200">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div className="p-2.5 bg-white rounded border border-gray-200">
                                  <span className="font-bold text-gray-500 uppercase text-[10px] block">
                                    Mão de Obra
                                  </span>
                                  <div className="mt-1 text-gray-700">
                                    Taxa: {formatBRL(op.hourlyLaborRate)}/h · Total: {formatBRL(op.plannedLaborCost)} ({op.plannedLaborHours.toFixed(2)}h)
                                  </div>
                                </div>
                                <div className="p-2.5 bg-white rounded border border-gray-200">
                                  <span className="font-bold text-gray-500 uppercase text-[10px] block">
                                    Custo de Máquina
                                  </span>
                                  <div className="mt-1 text-gray-700">
                                    Taxa: {formatBRL(op.hourlyMachineRate)}/h · Total: {formatBRL(op.plannedMachineCost)} ({op.plannedMachineHours.toFixed(2)}h)
                                  </div>
                                </div>
                                <div className="p-2.5 bg-white rounded border border-gray-200">
                                  <span className="font-bold text-gray-500 uppercase text-[10px] block">
                                    Materiais Específicos da Etapa
                                  </span>
                                  <div className="mt-1 text-gray-700">
                                    {op.materialName ? `${op.materialName} · Total: ${formatBRL(op.materialPlannedCost)}` : 'Nenhum material avulso'}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-xs">
                <tr>
                  <td colSpan={6} className="py-2 px-4 text-right text-gray-600 uppercase tracking-wider text-[11px]">
                    Subtotal Tarefas / Processos:
                  </td>
                  <td className="py-2 px-4 text-right font-bold text-[#00897B] font-mono">
                    {formatBRL(subtotalTarefas)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Resumo Consolidado do Bloco A */}
        <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#01B8AA] text-white flex items-center justify-center font-bold text-lg shrink-0">
              Σ
            </div>
            <div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                CUSTO TOTAL (Matéria Prima + Tarefas)
              </span>
              <p className="text-xs text-gray-500">
                Subtotal Matérias-Primas ({formatBRL(subtotalMateriais)}) + Subtotal Processos ({formatBRL(subtotalTarefas)})
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-[#00897B] font-mono">
              {formatBRL(custoTotalBlocoA)}
            </span>
            <span className="text-xs text-gray-500 block font-mono">
              {formatBRLUnit(custoUnitarioBlocoA)} por {product.productionUnit}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BLOCO B: FORMAÇÃO DE PREÇO (TRIBUTAÇÕES E ENCARGOS 'POR DENTRO') */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#01B8AA] text-white font-bold text-xs flex items-center justify-center">
              B
            </span>
            <div>
              <h3 className="text-base font-bold text-[#374151]">
                Bloco B: Formação de Preço (Tributações e Encargos 'Por Dentro')
              </h3>
              <p className="text-xs text-gray-500">
                Fórmula: Valor Markup = Custo Total / (1 - Soma Índices). Exibe os valores proporcionais em Reais (R$).
              </p>
            </div>
          </div>
          {isDraftMode && pricingDirty && (
            <button
              onClick={handleSavePricingConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Alíquotas
            </button>
          )}
        </div>

        {/* Inputs de Alíquotas 'Por Dentro' */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* % Margem de Lucro */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % Margem de Lucro
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.profitMarginPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    profitMarginPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-emerald-600 font-mono">
              = {formatBRL(calculatedPricing.profitMarginValue)}
            </div>
          </div>

          {/* % Comissão */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % Comissão
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.commissionPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    commissionPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-700 font-mono">
              = {formatBRL(calculatedPricing.commissionValue)}
            </div>
          </div>

          {/* % Imposto */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % Imposto (Simples/Lucro)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.taxPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    taxPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-700 font-mono">
              = {formatBRL(calculatedPricing.taxValue)}
            </div>
          </div>

          {/* % Juros */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % Juros / Financeiro
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.interestPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    interestPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-700 font-mono">
              = {formatBRL(calculatedPricing.interestValue)}
            </div>
          </div>
        </div>

        {/* Tabela de Demonstração de Markup 'Por Dentro' */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-xs text-[#374151]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Item da Formação de Preço</th>
                <th className="py-2.5 px-4 text-center">Alíquota (%)</th>
                <th className="py-2.5 px-4 text-right">Valor em Reais (R$)</th>
                <th className="py-2.5 px-4">Regra de Cálculo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="even:bg-slate-50/40">
                <td className="py-2 px-4 font-semibold text-gray-800">Custo Total de Produção (Bloco A)</td>
                <td className="py-2 px-4 text-center font-mono text-gray-500">
                  {calculatedPricing.markupValue > 0
                    ? ((custoTotalBlocoA / calculatedPricing.markupValue) * 100).toFixed(2) + '%'
                    : '—'}
                </td>
                <td className="py-2 px-4 text-right font-mono font-bold text-gray-900">
                  {formatBRL(custoTotalBlocoA)}
                </td>
                <td className="py-2 px-4 text-gray-500">Matéria-Prima + Tarefas</td>
              </tr>
              <tr className="even:bg-slate-50/40">
                <td className="py-2 px-4 font-semibold text-emerald-700">Margem de Lucro Alvo</td>
                <td className="py-2 px-4 text-center font-mono font-bold text-emerald-700">
                  {pricingForm.profitMarginPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-4 text-right font-mono font-bold text-emerald-700">
                  {formatBRL(calculatedPricing.profitMarginValue)}
                </td>
                <td className="py-2 px-4 text-gray-500">Valor Markup × % Margem</td>
              </tr>
              <tr className="even:bg-slate-50/40">
                <td className="py-2 px-4 font-semibold text-gray-800">Comissão de Vendas</td>
                <td className="py-2 px-4 text-center font-mono font-bold text-gray-700">
                  {pricingForm.commissionPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-4 text-right font-mono font-semibold text-gray-800">
                  {formatBRL(calculatedPricing.commissionValue)}
                </td>
                <td className="py-2 px-4 text-gray-500">Valor Markup × % Comissão</td>
              </tr>
              <tr className="even:bg-slate-50/40">
                <td className="py-2 px-4 font-semibold text-gray-800">Impostos 'Por Dentro'</td>
                <td className="py-2 px-4 text-center font-mono font-bold text-gray-700">
                  {pricingForm.taxPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-4 text-right font-mono font-semibold text-gray-800">
                  {formatBRL(calculatedPricing.taxValue)}
                </td>
                <td className="py-2 px-4 text-gray-500">Valor Markup × % Imposto</td>
              </tr>
              <tr className="even:bg-slate-50/40">
                <td className="py-2 px-4 font-semibold text-gray-800">Encargos Financeiros / Juros</td>
                <td className="py-2 px-4 text-center font-mono font-bold text-gray-700">
                  {pricingForm.interestPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-4 text-right font-mono font-semibold text-gray-800">
                  {formatBRL(calculatedPricing.interestValue)}
                </td>
                <td className="py-2 px-4 text-gray-500">Valor Markup × % Juros</td>
              </tr>
            </tbody>
            <tfoot className="bg-teal-50/70 border-t border-teal-200 font-semibold text-xs">
              <tr>
                <td className="py-2.5 px-4 font-bold text-[#00897B] uppercase tracking-wider text-[11px]">
                  VALOR BASE (MARKUP DIVISOR):
                </td>
                <td className="py-2.5 px-4 text-center font-mono font-bold text-[#00897B]">
                  Σ Índices = {calculatedPricing.somaIndicesPercent.toFixed(2)}%
                </td>
                <td className="py-2.5 px-4 text-right font-black text-[#00897B] font-mono text-sm">
                  {formatBRL(calculatedPricing.markupValue)}
                </td>
                <td className="py-2.5 px-4 text-[11px] text-[#00897B]/80 font-mono">
                  Divisor: (1 - {(calculatedPricing.somaIndices).toFixed(4)}) = {calculatedPricing.markupDivisor.toFixed(4)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {calculatedPricing.warning && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{calculatedPricing.warning}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BLOCO C: IMPOSTOS ADICIONAIS E VALOR FINAL ('POR FORA') */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#01B8AA] text-white font-bold text-xs flex items-center justify-center">
              C
            </span>
            <div>
              <h3 className="text-base font-bold text-[#374151]">
                Bloco C: Impostos Adicionais e Valor Final ('Por Fora')
              </h3>
              <p className="text-xs text-gray-500">
                Fórmula: Total = Valor Markup + Despesas Adicionais + Valor IPI + Valor ICMS ST.
              </p>
            </div>
          </div>
        </div>

        {/* Inputs do Bloco C */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Despesas Adicionais em R$ */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              Despesas Adicionais (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.additionalExpenses}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    additionalExpenses: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pl-9 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Ex: Frete, embalagem especial, facas</p>
          </div>

          {/* % IPI */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % IPI ('Por Fora')
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.ipiPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    ipiPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-700 font-mono">
              = {formatBRL(calculatedPricing.ipiValue)}
            </div>
          </div>

          {/* % ICMS ST */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
              % ICMS ST ('Por Fora')
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isDraftMode}
                value={pricingForm.icmsStPercent}
                onChange={(e) => {
                  setPricingForm({
                    ...pricingForm,
                    icmsStPercent: parseFloat(e.target.value) || 0,
                  });
                  setPricingDirty(true);
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none disabled:bg-gray-100"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-gray-400 font-bold">%</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-gray-700 font-mono">
              = {formatBRL(calculatedPricing.icmsStValue)}
            </div>
          </div>
        </div>

        {/* Card Destaque: PREÇO FINAL TOTAL */}
        <div className="p-6 bg-slate-900 text-white rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <Receipt className="w-5 h-5 text-[#01B8AA]" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                PREÇO FINAL DE VENDA AO CLIENTE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Valor Markup ({formatBRL(calculatedPricing.markupValue)}) + Despesas Adicionais ({formatBRL(calculatedPricing.additionalExpenses)}) + IPI ({formatBRL(calculatedPricing.ipiValue)}) + ICMS ST ({formatBRL(calculatedPricing.icmsStValue)})
            </p>
          </div>

          <div className="flex items-center gap-8 text-right">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-medium">
                Preço Unitário Final
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {formatBRLUnit(calculatedPricing.finalUnitCost)}
              </span>
              <span className="text-[10px] text-slate-400 block">por {product.productionUnit}</span>
            </div>

            <div className="pl-6 border-l border-slate-700">
              <span className="text-xs uppercase tracking-wider text-[#01B8AA] block font-bold">
                VALOR TOTAL FINAL
              </span>
              <span className="text-3xl font-black font-mono text-white">
                {formatBRL(calculatedPricing.finalTotal)}
              </span>
              <span className="text-[10px] text-emerald-400 block font-medium">
                Margem Líquida Prevista: {pricingForm.profitMarginPercent}% ({formatBRL(calculatedPricing.profitMarginValue)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Adicionar/Editar Operação */}
      <AddOperationModal
        isOpen={isOpModalOpen}
        onClose={() => setIsOpModalOpen(false)}
        onSaveOperation={handleSaveOperation}
        standardTasks={standardTasks}
        productQuantity={product.quantity}
        productUnit={product.productionUnit}
        initialOperation={editingOp}
        nextOrder={(displayedOperations.length || 0) + 1}
      />

      {/* Modal de Adicionar/Editar Matéria-Prima */}
      <AddMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onSaveMaterial={handleSaveMaterial}
        initialMaterial={editingMaterial}
      />

      {/* Confirmação de Remoção de Operação */}
      <ConfirmDialog
        isOpen={deleteOpConfirmOpen}
        onClose={() => {
          setDeleteOpConfirmOpen(false);
          setOpToDelete(null);
        }}
        onConfirm={handleConfirmDeleteOp}
        title="Remover Tarefa do Orçamento"
        message="Deseja realmente remover esta etapa do orçamento? Os custos do Bloco A e os preços finais dos Blocos B e C serão recalculados imediatamente."
        type="danger"
        confirmText="Remover Tarefa"
      />

      {/* Confirmação de Remoção de Matéria-Prima */}
      <ConfirmDialog
        isOpen={deleteMatConfirmOpen}
        onClose={() => {
          setDeleteMatConfirmOpen(false);
          setMatToDelete(null);
        }}
        onConfirm={handleConfirmDeleteMaterial}
        title="Remover Matéria-Prima do Orçamento"
        message="Deseja realmente remover esta matéria-prima do orçamento? O custo do Bloco A e o preço final serão recalculados imediatamente."
        type="danger"
        confirmText="Remover Matéria-Prima"
      />
    </div>
  );
};
