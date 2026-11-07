/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Product,
  StandardTask,
  BudgetRevision,
  ProductStatus,
  ProductMaterialItem,
  ProductPricing,
  ProductProcessItem,
  Machine,
  DEFAULT_PRODUCT_PRICING,
  PRODUCT_STATUS_LABELS,
} from '../../types';
import {
  formatBRL,
  formatBRLUnit,
  calculateMarkupAndPricing,
  getProductProcesses,
  calculateProcessItemCost,
  formatHoursToHMin,
} from '../../services/calculator';
import { ProductStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AddProcessModal } from './AddProcessModal';
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
  Cpu,
  Check,
  RotateCcw,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  standardTasks: StandardTask[];
  machines?: Machine[];
  onBack: () => void;
  onRefresh: () => void;
  onGoToLogs: (productId: string) => void;
  onGoToAnalysis: (productId: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  standardTasks,
  machines = [],
  onBack,
  onRefresh,
  onGoToLogs,
  onGoToAnalysis,
}) => {
  // Estado local centralizado do produto: garante atualização síncrona e imediata de toda a tela
  const [currentProduct, setCurrentProduct] = useState<Product>(product);

  useEffect(() => {
    setCurrentProduct(product);
  }, [product]);

  // Carregamento de máquinas cadastradas
  const [localMachines, setLocalMachines] = useState<Machine[]>(machines);
  useEffect(() => {
    if (!machines || machines.length === 0) {
      storage.getAllMachines().then((loaded) => setLocalMachines(loaded.filter((m) => m.active)));
    } else {
      setLocalMachines(machines);
    }
  }, [machines]);

  // Modais de Processos (Máquinas & Tarefas Produtivas)
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProductProcessItem | null>(null);
  const [deleteProcessConfirmOpen, setDeleteProcessConfirmOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<string | null>(null);

  // Modais de Matéria-Prima (Bloco A)
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<ProductMaterialItem | null>(null);
  const [deleteMatConfirmOpen, setDeleteMatConfirmOpen] = useState(false);
  const [matToDelete, setMatToDelete] = useState<string | null>(null);

  // Modal para Alteração Rápida de Tiragem / Quantidade
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [newQuantityInput, setNewQuantityInput] = useState<number>(currentProduct.quantity);
  const [newUnitInput, setNewUnitInput] = useState<string>(currentProduct.productionUnit || 'Exemplares');
  const [syncMilheiroWithQty, setSyncMilheiroWithQty] = useState(true);

  // Confirmação para mover o orçamento inteiro para a Lixeira
  const [deleteProductConfirmOpen, setDeleteProductConfirmOpen] = useState(false);

  // Mensagem temporária de sucesso (Feedback amigável)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Seleção de revisão histórica para consulta
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number>(
    currentProduct.currentRevisionNumber || 1
  );

  // Estado local para os parâmetros de precificação dos Blocos B e C
  const [pricingForm, setPricingForm] = useState<ProductPricing>(
    currentProduct.pricing || currentProduct.activeRevision?.pricing || DEFAULT_PRODUCT_PRICING
  );
  const [pricingDirty, setPricingDirty] = useState(false);
  const autoSavePricingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const config = currentProduct.pricing || currentProduct.activeRevision?.pricing || DEFAULT_PRODUCT_PRICING;
    setPricingForm(config);
    setPricingDirty(false);
  }, [currentProduct.id, currentProduct.pricing]);

  // ==========================================
  // RECÁLCULO AUTOMÁTICO EM TEMPO REAL (SEM RELOAD)
  // ==========================================
  // Listas ativas de itens (sempre editáveis, nunca congeladas)
  const displayedProcessos: ProductProcessItem[] = getProductProcesses(currentProduct);
  const displayedMaterials: ProductMaterialItem[] = currentProduct.materials || [];

  // 1. Subtotal Matérias-Primas (Bloco A)
  const subtotalMateriais = displayedMaterials.reduce((sum, m) => sum + (m.totalCusto || 0), 0);

  // 2. Subtotal Máquinas & Tarefas Produtivas (Bloco A)
  const subtotalProcessos = displayedProcessos.reduce((sum, p) => sum + (p.custoTotal || 0), 0);

  // CUSTO TOTAL BLOCO A (Matéria Prima + Máquinas & Tarefas Produtivas)
  const custoTotalBlocoA = Number((subtotalMateriais + subtotalProcessos).toFixed(2));
  const custoUnitarioBlocoA =
    currentProduct.quantity > 0 ? Number((custoTotalBlocoA / currentProduct.quantity).toFixed(4)) : 0;

  // BLOCOS B E C: FORMAÇÃO DE PREÇO E VALOR FINAL
  const calculatedPricing = calculateMarkupAndPricing(
    custoTotalBlocoA,
    pricingForm,
    currentProduct.quantity
  );

  // ==========================================
  // ATUALIZAÇÃO E SALVAMENTO DE ALÍQUOTAS (BLOCOS B E C)
  // ==========================================
  const updateAndAutoSavePricing = (newPricing: ProductPricing) => {
    setPricingForm(newPricing);
    setPricingDirty(true);

    if (autoSavePricingTimer.current) {
      clearTimeout(autoSavePricingTimer.current);
    }

    autoSavePricingTimer.current = setTimeout(async () => {
      const updated: Product = {
        ...currentProduct,
        pricing: newPricing,
        ...(currentProduct.activeRevision ? {
          activeRevision: {
            ...currentProduct.activeRevision,
            pricing: newPricing,
          },
        } : {}),
      };
      setCurrentProduct(updated);
      await storage.saveProduct(updated);
      setPricingDirty(false);
    }, 400);
  };

  const handleSavePricingConfig = async () => {
    if (autoSavePricingTimer.current) {
      clearTimeout(autoSavePricingTimer.current);
      autoSavePricingTimer.current = null;
    }
    const updated: Product = {
      ...currentProduct,
      pricing: pricingForm,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          pricing: newPricingConfig(pricingForm),
        },
      } : {}),
    };
    setCurrentProduct(updated);
    await storage.saveProduct(updated);
    setPricingDirty(false);
    showToast('Alíquotas de precificação salvas com sucesso!');
    onRefresh();
  };

  function newPricingConfig(p: ProductPricing): ProductPricing {
    return { ...p };
  }

  // ==========================================
  // HANDLERS PARA MATÉRIA-PRIMA (BLOCO A)
  // ==========================================
  const handleSaveMaterial = async (materialItem: ProductMaterialItem) => {
    let list = [...(currentProduct.materials || [])];
    const idx = list.findIndex((m) => m.id === materialItem.id);
    if (idx >= 0) {
      list[idx] = materialItem;
    } else {
      list.push(materialItem);
    }

    const updatedProduct: Product = {
      ...currentProduct,
      materials: list,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          materials: list,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    setIsMaterialModalOpen(false);
    setEditingMaterial(null);
    showToast(idx >= 0 ? 'Matéria-prima atualizada!' : 'Matéria-prima adicionada ao orçamento!');
    onRefresh();
  };

  const handleConfirmDeleteMaterial = async () => {
    if (!matToDelete) return;
    const list = (currentProduct.materials || []).filter((m) => m.id !== matToDelete);
    const updatedProduct: Product = {
      ...currentProduct,
      materials: list,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          materials: list,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    setMatToDelete(null);
    setDeleteMatConfirmOpen(false);
    showToast('Matéria-prima removida do orçamento.');
    onRefresh();
  };

  // ==========================================
  // HANDLERS PARA MÁQUINAS & TAREFAS PRODUTIVAS (BLOCO A)
  // ==========================================
  const handleSaveProcess = async (processItem: ProductProcessItem, keepOpen = false) => {
    let list = [...getProductProcesses(currentProduct)];
    const existingIndex = list.findIndex((p) => p.id === processItem.id);

    if (existingIndex >= 0) {
      list[existingIndex] = processItem;
    } else {
      list.push(processItem);
    }

    list = list.map((p, idx) => ({
      ...p,
      order: idx + 1,
      custoTotal: calculateProcessItemCost(p),
    }));

    const updatedProduct: Product = {
      ...currentProduct,
      processos: list,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          processos: list,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);

    if (keepOpen) {
      setEditingProcess(null);
      showToast('Processo salvo! Você pode cadastrar o próximo.');
    } else {
      setIsProcessModalOpen(false);
      setEditingProcess(null);
      showToast(existingIndex >= 0 ? 'Processo atualizado!' : 'Processo vinculado ao orçamento!');
    }
    onRefresh();
  };

  const handleConfirmDeleteProcess = async () => {
    if (!processToDelete) return;
    const filtered = getProductProcesses(currentProduct)
      .filter((p) => p.id !== processToDelete)
      .map((p, idx) => ({ ...p, order: idx + 1 }));

    const updatedProduct: Product = {
      ...currentProduct,
      processos: filtered,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          processos: filtered,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    setProcessToDelete(null);
    setDeleteProcessConfirmOpen(false);
    showToast('Processo produtivo removido.');
    onRefresh();
  };

  const handleMoveProcess = async (index: number, direction: 'UP' | 'DOWN') => {
    const list = [...getProductProcesses(currentProduct)];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((p, idx) => ({ ...p, order: idx + 1 }));
    const updatedProduct: Product = {
      ...currentProduct,
      processos: reordered,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          processos: reordered,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    onRefresh();
  };

  // ==========================================
  // ALTERAÇÃO DE TIRAGEM (RECÁLCULO IMEDIATO)
  // ==========================================
  const handleOpenQuantityModal = () => {
    setNewQuantityInput(currentProduct.quantity);
    setNewUnitInput(currentProduct.productionUnit || 'Exemplares');
    setSyncMilheiroWithQty(true);
    setIsQuantityModalOpen(true);
  };

  const handleSaveQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuantityInput || newQuantityInput <= 0) {
      alert('A tiragem deve ser maior que zero.');
      return;
    }

    let updatedProcessos = [...getProductProcesses(currentProduct)];
    if (syncMilheiroWithQty) {
      updatedProcessos = updatedProcessos.map((p) => {
        if (p.tipoCobranca === 'MILHEIRO') {
          const updatedItem = {
            ...p,
            quantidadeProducao: newQuantityInput,
          };
          return {
            ...updatedItem,
            custoTotal: calculateProcessItemCost(updatedItem),
          };
        }
        return p;
      });
    }

    const updatedProduct: Product = {
      ...currentProduct,
      quantity: Number(newQuantityInput),
      productionUnit: newUnitInput.trim() || 'Exemplares',
      processos: updatedProcessos,
      ...(currentProduct.activeRevision ? {
        activeRevision: {
          ...currentProduct.activeRevision,
          productQuantity: Number(newQuantityInput),
          processos: updatedProcessos,
        },
      } : {}),
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    setIsQuantityModalOpen(false);
    showToast(`Tiragem alterada para ${newQuantityInput.toLocaleString('pt-BR')} ${newUnitInput}. Todos os totais foram recalculados!`);
    onRefresh();
  };

  // ==========================================
  // STATUS & APROVAÇÃO (FLUXO FLEXÍVEL, 100% EDITÁVEL)
  // ==========================================
  const handleStatusChange = async (newStatus: ProductStatus) => {
    const updatedProduct: Product = {
      ...currentProduct,
      status: newStatus,
    };
    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    showToast(`Status atualizado para: ${PRODUCT_STATUS_LABELS[newStatus]}`);
    onRefresh();
  };

  // Aprovação informativa: registra snapshot no histórico, mas MANTÉM O ORÇAMENTO 100% EDITÁVEL
  const handleApproveBudget = async () => {
    if (displayedProcessos.length === 0 && displayedMaterials.length === 0) {
      alert('Adicione pelo menos uma matéria-prima ou máquina/tarefa produtiva antes de aprovar o orçamento.');
      return;
    }

    const nextRevNum = (currentProduct.revisions?.length || 0) + 1;
    const frozenRevision: BudgetRevision = {
      revisionNumber: nextRevNum,
      approvedAt: new Date().toISOString(),
      approvedBy: 'Usuário do Sistema',
      notes: `Orçamento aprovado com ${displayedMaterials.length} insumos e ${displayedProcessos.length} máquinas/tarefas produtivas.`,
      productQuantity: currentProduct.quantity,
      operations: [],
      processos: JSON.parse(JSON.stringify(displayedProcessos)),
      materials: JSON.parse(JSON.stringify(displayedMaterials)),
      pricing: JSON.parse(JSON.stringify(pricingForm)),
      totalSetupSeconds: 0,
      totalProductionSeconds: 0,
      totalTimeSeconds: 0,
      totalLaborHours: 0,
      totalMachineHours: 0,
      totalLaborCost: 0,
      totalMachineCost: 0,
      totalMaterialCost: Number(subtotalMateriais.toFixed(2)),
      totalTasksCost: Number(subtotalProcessos.toFixed(2)),
      totalProcessosCost: Number(subtotalProcessos.toFixed(2)),
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
      ...currentProduct,
      status: 'APROVADO',
      currentRevisionNumber: nextRevNum,
      revisions: [...(currentProduct.revisions || []), frozenRevision],
      activeRevision: frozenRevision,
      processos: displayedProcessos,
      materials: displayedMaterials,
      pricing: pricingForm,
    };

    setCurrentProduct(updatedProduct);
    await storage.saveProduct(updatedProduct);
    setSelectedRevisionNumber(nextRevNum);
    setPricingDirty(false);
    showToast('Orçamento Aprovado com sucesso! Permanece 100% editável para qualquer alteração.');
    onRefresh();
  };

  const handleConfirmDeleteProduct = async () => {
    await storage.deleteProduct(currentProduct.id);
    setDeleteProductConfirmOpen(false);
    onBack();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Toast de Confirmação Rápida */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#00897B] text-white px-4 py-3 rounded-xl shadow-lg border border-teal-400 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

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
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-bold text-sm text-gray-500">{currentProduct.code}</span>
              <h2 className="text-lg font-bold text-[#374151] tracking-tight">{currentProduct.name}</h2>
              <ProductStatusBadge status={currentProduct.status} />
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> 100% Editável
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
              {currentProduct.client && <span>Cliente: <strong>{currentProduct.client}</strong></span>}
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                Tiragem: <strong className="text-gray-800">{currentProduct.quantity.toLocaleString('pt-BR')} {currentProduct.productionUnit}</strong>
                <button
                  onClick={handleOpenQuantityModal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#01B8AA] hover:text-[#00897B] hover:underline"
                  title="Alterar Tiragem do Orçamento"
                >
                  <Edit2 className="w-3 h-3" /> Alterar
                </button>
              </span>
              <span>·</span>
              <span>Orçado em: {new Date(currentProduct.budgetDate).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => onGoToLogs(currentProduct.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4 text-[#01B8AA]" />
            Apontamento Espelho
          </button>
          <button
            onClick={() => onGoToAnalysis(currentProduct.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
          >
            <Coins className="w-4 h-4" />
            Ver Comparativo Orçado x Realizado
          </button>
          <button
            onClick={() => setDeleteProductConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            title="Excluir este orçamento"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            Excluir
          </button>
        </div>
      </div>

      {/* Painel Informativo de Status e Ações Flexíveis (SEM BLOQUEIOS OU CONGELAMENTO) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border bg-white border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              currentProduct.status === 'APROVADO'
                ? 'bg-emerald-100 text-emerald-700'
                : currentProduct.status === 'EM_PRODUCAO'
                ? 'bg-blue-100 text-blue-700'
                : currentProduct.status === 'CONCLUIDO'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {currentProduct.status === 'APROVADO' ? (
              <FileCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <Edit2 className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#374151]">
                Status do Orçamento:
              </span>
              <ProductStatusBadge status={currentProduct.status} />
              {currentProduct.activeRevision && (
                <span className="text-[11px] text-gray-500 font-mono">
                  (Revisão nº {currentProduct.currentRevisionNumber || 1} registrada)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              <strong>Modo de Edição Livre:</strong> Matérias-primas, máquinas, tarefas, tiragem e alíquotas permanecem 100% editáveis a qualquer momento.
            </p>
          </div>
        </div>

        {/* Controles de Status e Ações Sem Travas */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Seletor Rápido de Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 font-medium">Alterar Status:</span>
            <select
              value={currentProduct.status}
              onChange={(e) => handleStatusChange(e.target.value as ProductStatus)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
            >
              <option value="RASCUNHO">Rascunho / Em Edição</option>
              <option value="APROVADO">Orçamento Aprovado</option>
              <option value="EM_PRODUCAO">Em Produção</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {currentProduct.status !== 'APROVADO' ? (
            <button
              onClick={handleApproveBudget}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg shadow-sm transition-colors"
              title="Aprova a versão do orçamento e mantém a edição 100% aberta"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar Versão do Orçamento
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('EM_PRODUCAO')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Iniciar Produção
              </button>
              <button
                onClick={handleApproveBudget}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                title="Registra uma nova versão no histórico de revisões sem fechar a edição"
              >
                <History className="w-3.5 h-3.5 text-gray-400" />
                Salvar Nova Versão no Histórico
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BLOCO A: CUSTOS (MATÉRIA-PRIMA + MÁQUINAS & TAREFAS PRODUTIVAS) */}
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
                Levantamento detalhado dos insumos e das horas produtivas, de acerto ou milheiros.
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
                ({formatBRLUnit(custoUnitarioBlocoA)} / {currentProduct.productionUnit})
              </span>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO DE MATÉRIAS-PRIMAS (SEMPRE EDITÁVEL) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#01B8AA]" />
              <h4 className="text-sm font-bold text-[#374151]">Matérias-Primas (Insumos)</h4>
              <span className="text-xs text-gray-400">
                ({displayedMaterials.length} {displayedMaterials.length === 1 ? 'item' : 'itens'})
              </span>
            </div>
            {/* BOTÃO SEMPRE ATIVO E FUNCIONAL */}
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
                  <th className="py-2.5 px-4 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      Nenhuma matéria-prima adicionada neste bloco. Clique em "Adicionar Matéria-Prima".
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
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 2. SEÇÃO DE MÁQUINAS & TAREFAS PRODUTIVAS (SEMPRE EDITÁVEL) */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#01B8AA]" />
              <h4 className="text-sm font-bold text-[#374151]">Máquinas & Tarefas Produtivas</h4>
              <span className="text-xs text-gray-400">
                ({displayedProcessos.length} {displayedProcessos.length === 1 ? 'item' : 'itens'})
              </span>
            </div>
            {/* BOTÃO SEMPRE ATIVO E FUNCIONAL */}
            <button
              onClick={() => {
                setEditingProcess(null);
                setIsProcessModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Vincular Máquina / Tarefa
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3 text-center w-20">Tipo</th>
                  <th className="py-2.5 px-4">Máquina / Tarefa Vinculada</th>
                  <th className="py-2.5 px-4 text-center">Tipo de Cobrança</th>
                  <th className="py-2.5 px-4 text-right">Parâmetros Previstos</th>
                  <th className="py-2.5 px-4 text-right font-bold text-gray-800">Custo Total (R$)</th>
                  <th className="py-2.5 px-4 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedProcessos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      <Cpu className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-600">Nenhuma máquina ou tarefa produtiva vinculada a este orçamento.</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Clique em "Vincular Máquina / Tarefa" para compor os custos operacionais por hora ou milheiro.
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedProcessos.map((proc, idx) => {
                    const isHora = proc.tipoCobranca === 'HORA';

                    return (
                      <tr key={proc.id} className="hover:bg-teal-50/20 even:bg-slate-50/40 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-gray-400">
                          <div className="flex flex-col items-center">
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMoveProcess(idx, 'UP')}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20 cursor-pointer"
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-gray-700">{proc.order}</span>
                            <button
                              disabled={idx === displayedProcessos.length - 1}
                              onClick={() => handleMoveProcess(idx, 'DOWN')}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20 cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {proc.tipoItem === 'MAQUINA' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Cpu className="w-3 h-3" />
                              Máquina
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                              <Layers className="w-3 h-3" />
                              Tarefa
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-gray-800">{proc.nome}</div>
                          {proc.descricao && (
                            <div className="text-[11px] text-gray-500 mt-0.5">{proc.descricao}</div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          {isHora ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                              <Clock className="w-3 h-3" />
                              Custo por Hora
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Package className="w-3 h-3" />
                              Custo por Milheiro
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono text-gray-700">
                          {isHora ? (
                            <div>
                              <div>
                                <strong className="text-gray-900">{formatHoursToHMin(proc.tempoPrevistoHoras)}</strong> ({proc.tempoPrevistoHoras.toFixed(2)}h) × {formatBRL(proc.custoHora)}/h
                              </div>
                              {(proc.tempoProdutivoHoras !== undefined || proc.tempoAcertoHoras !== undefined || proc.tempoExtraHoras !== undefined) && (
                                <div className="text-[10px] text-gray-500 mt-0.5 space-x-1">
                                  <span className="text-blue-700 font-semibold" title="Tempo Produtivo">
                                    Prod: {formatHoursToHMin(proc.tempoProdutivoHoras)}
                                  </span>
                                  <span>·</span>
                                  <span className="text-amber-700 font-semibold" title="Tempo de Acerto">
                                    Acerto: {formatHoursToHMin(proc.tempoAcertoHoras)}
                                  </span>
                                  <span>·</span>
                                  <span className="text-purple-700 font-semibold" title="Tempo Extra">
                                    Extra: {formatHoursToHMin(proc.tempoExtraHoras)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>
                              <strong>{proc.quantidadeProducao.toLocaleString('pt-BR')} un</strong> × {formatBRL(proc.custoMilheiro)}/milheiro
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#00897B] text-sm">
                          {formatBRL(proc.custoTotal)}
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingProcess(proc);
                                setIsProcessModalOpen(true);
                              }}
                              title="Editar Processo"
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setProcessToDelete(proc.id);
                                setDeleteProcessConfirmOpen(true);
                              }}
                              title="Excluir Processo"
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold text-xs">
                <tr>
                  <td colSpan={5} className="py-2.5 px-4 text-right text-gray-600 uppercase tracking-wider text-[11px]">
                    Subtotal Máquinas & Tarefas Produtivas:
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-[#00897B] font-mono text-sm">
                    {formatBRL(subtotalProcessos)}
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
                CUSTO TOTAL (Matéria Prima + Máquinas & Tarefas)
              </span>
              <p className="text-xs text-gray-500">
                Subtotal Matérias-Primas ({formatBRL(subtotalMateriais)}) + Subtotal Máquinas & Tarefas ({formatBRL(subtotalProcessos)})
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-[#00897B] font-mono">
              {formatBRL(custoTotalBlocoA)}
            </span>
            <span className="text-xs text-gray-500 block font-mono">
              {formatBRLUnit(custoUnitarioBlocoA)} por {currentProduct.productionUnit}
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
                Fórmula: Valor Markup = Custo Total / (1 - Soma Índices). Totalmente editável, com recálculo automático em tempo real.
              </p>
            </div>
          </div>
          {pricingDirty && (
            <button
              onClick={handleSavePricingConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Alíquotas
            </button>
          )}
        </div>

        {/* Inputs de Alíquotas 'Por Dentro' (SEMPRE HABILITADOS) */}
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
                value={pricingForm.profitMarginPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    profitMarginPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                value={pricingForm.commissionPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    commissionPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                value={pricingForm.taxPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    taxPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                value={pricingForm.interestPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    interestPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                <td className="py-2 px-4 text-gray-500">Matéria-Prima + Tarefas Produtivas</td>
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

        {/* Inputs do Bloco C (SEMPRE HABILITADOS) */}
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
                value={pricingForm.additionalExpenses}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    additionalExpenses: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pl-9 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                value={pricingForm.ipiPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    ipiPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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
                value={pricingForm.icmsStPercent}
                onChange={(e) => {
                  updateAndAutoSavePricing({
                    ...pricingForm,
                    icmsStPercent: parseFloat(e.target.value) || 0,
                  });
                }}
                className="w-full text-sm font-bold font-mono text-gray-800 bg-white border border-gray-300 rounded-lg p-2 pr-7 focus:ring-2 focus:ring-[#01B8AA] focus:outline-none"
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

          <div className="flex items-center gap-8 text-right flex-wrap justify-center md:justify-end">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-medium">
                Preço Unitário Final
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {formatBRLUnit(calculatedPricing.finalUnitCost)}
              </span>
              <span className="text-[10px] text-slate-400 block">por {currentProduct.productionUnit}</span>
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

      {/* Modal de Alteração Rápida de Tiragem */}
      <Modal
        isOpen={isQuantityModalOpen}
        onClose={() => setIsQuantityModalOpen(false)}
        title="Alterar Tiragem do Orçamento"
        subtitle="Ao alterar a tiragem, todos os custos unitários e preços finais são recalculados imediatamente."
        maxWidth="md"
      >
        <form onSubmit={handleSaveQuantity} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nova Tiragem (Quantidade) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={newQuantityInput}
                onChange={(e) => setNewQuantityInput(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unidade de Medida *
              </label>
              <input
                type="text"
                required
                value={newUnitInput}
                onChange={(e) => setNewUnitInput(e.target.value)}
                placeholder="Ex: Exemplares, Unidades"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
          </div>

          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={syncMilheiroWithQty}
                onChange={(e) => setSyncMilheiroWithQty(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#01B8AA] accent-[#01B8AA]"
              />
              <span className="text-xs text-teal-900 leading-snug">
                <strong>Sincronizar tarefas por milheiro:</strong> atualizar automaticamente a quantidade das máquinas e tarefas cobradas por milheiro para a nova tiragem ({newQuantityInput.toLocaleString('pt-BR')} un).
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsQuantityModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm"
            >
              Aplicar Nova Tiragem
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Adicionar/Editar Máquina ou Tarefa Produtiva */}
      <AddProcessModal
        isOpen={isProcessModalOpen}
        onClose={() => {
          setIsProcessModalOpen(false);
          setEditingProcess(null);
        }}
        onSaveProcess={handleSaveProcess}
        machines={localMachines}
        standardTasks={standardTasks}
        productQuantity={currentProduct.quantity}
        productUnit={currentProduct.productionUnit}
        initialProcess={editingProcess}
        nextOrder={(displayedProcessos.length || 0) + 1}
      />

      {/* Modal de Adicionar/Editar Matéria-Prima */}
      <AddMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => {
          setIsMaterialModalOpen(false);
          setEditingMaterial(null);
        }}
        onSaveMaterial={handleSaveMaterial}
        initialMaterial={editingMaterial}
      />

      {/* Confirmação de Remoção de Processo (Máquina / Tarefa) */}
      <ConfirmDialog
        isOpen={deleteProcessConfirmOpen}
        onClose={() => {
          setDeleteProcessConfirmOpen(false);
          setProcessToDelete(null);
        }}
        onConfirm={handleConfirmDeleteProcess}
        title="Remover Processo Produtivo do Orçamento"
        message="Deseja realmente remover esta máquina/tarefa do orçamento? Os custos do Bloco A e os preços finais dos Blocos B e C serão recalculados imediatamente."
        type="danger"
        confirmText="Remover Processo"
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

      {/* Confirmação de Exclusão Definitiva do Orçamento */}
      <ConfirmDialog
        isOpen={deleteProductConfirmOpen}
        onClose={() => setDeleteProductConfirmOpen(false)}
        onConfirm={handleConfirmDeleteProduct}
        title="Excluir Orçamento Definitivamente"
        message={`Tem certeza que deseja excluir permanentemente o orçamento "${currentProduct.code} - ${currentProduct.name}"?\n\nEsta operação é imediata e irreversível.`}
        type="danger"
        confirmText="Excluir Definitivamente"
        cancelText="Cancelar"
      />
    </div>
  );
};
