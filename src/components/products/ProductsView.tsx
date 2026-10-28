/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Product,
  StandardTask,
  ProductStatus,
  PRODUCT_STATUS_LABELS,
} from '../../types';
import { formatBRL, formatBRLUnit } from '../../services/calculator';
import { ProductStatusBadge } from '../common/Badge';
import { ProductFormModal } from './ProductFormModal';
import { ProductDetailView } from './ProductDetailView';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import {
  Search,
  Plus,
  ArrowRight,
  Trash2,
  FileSpreadsheet,
  Calendar,
  Layers,
  Clock,
  Coins,
} from 'lucide-react';

interface ProductsViewProps {
  products: Product[];
  standardTasks: StandardTask[];
  onRefresh: () => void;
  onGoToLogs: (productId: string) => void;
  onGoToAnalysis: (productId: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  standardTasks,
  onRefresh,
  onGoToLogs,
  onGoToAnalysis,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'ALL'>('ALL');

  // Modal para criar/editar dados do produto
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Se um produto estiver selecionado, exibe a tela de detalhe/orçamento
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  if (selectedProduct) {
    return (
      <ProductDetailView
        product={selectedProduct}
        standardTasks={standardTasks}
        onBack={() => setSelectedProductId(null)}
        onRefresh={onRefresh}
        onGoToLogs={onGoToLogs}
        onGoToAnalysis={onGoToAnalysis}
      />
    );
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.client && p.client.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setIsFormModalOpen(true);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (editingProduct) {
      await storage.saveProduct({
        ...editingProduct,
        ...productData,
      } as Product);
    } else {
      const newProduct: Product = {
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        code: productData.code || 'PRD-001',
        name: productData.name || 'Novo Produto',
        client: productData.client,
        description: productData.description,
        quantity: productData.quantity || 1000,
        productionUnit: productData.productionUnit || 'Unidades',
        budgetDate: productData.budgetDate || new Date().toISOString().slice(0, 10),
        deadlineDate: productData.deadlineDate,
        notes: productData.notes,
        status: 'RASCUNHO',
        currentRevisionNumber: 0,
        revisions: [],
        draftOperations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.saveProduct(newProduct);
      // Abre direto o novo produto para adicionar operações
      setSelectedProductId(newProduct.id);
    }
    onRefresh();
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    const res = await storage.deleteProduct(productToDelete);
    if (!res.success) {
      setDeleteError(res.error || 'Falha ao excluir produto.');
    } else {
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-[#374151]">
            Produtos, Serviços & Orçamentos
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastre os produtos gráficos, monte a sequência de operações e aprove versões congeladas de orçamento.
          </p>
        </div>
        <button
          onClick={handleCreateProduct}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Produto / Orçamento
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: PRD-2026), nome ou cliente..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
            />
          </div>

          <span className="text-xs text-gray-500 font-medium tabular-nums">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
          </span>
        </div>

        {/* Abas de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-[#01B8AA] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Todos os Status
          </button>
          {(['RASCUNHO', 'APROVADO', 'EM_PRODUCAO', 'CONCLUIDO', 'CANCELADO'] as ProductStatus[]).map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-[#01B8AA] text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {PRODUCT_STATUS_LABELS[st]}
              </button>
            )
          )}
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-xl">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhum produto cadastrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Clique em "Novo Produto / Orçamento" para iniciar uma nova ordem.
            </p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const activeRev = p.activeRevision;
            const opsCount = activeRev ? activeRev.operations.length : p.draftOperations.length;
            const totalCost = activeRev
              ? activeRev.totalCost
              : p.draftOperations.reduce((sum, op) => sum + op.plannedTotalCost, 0);
            const unitCost = p.quantity > 0 ? totalCost / p.quantity : 0;

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{p.code}</span>
                    <ProductStatusBadge status={p.status} />
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {p.name}
                  </h4>
                  {p.client && (
                    <p className="text-xs font-medium text-slate-600 mt-0.5 truncate">
                      Cliente: {p.client}
                    </p>
                  )}
                  {p.description && (
                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        Tiragem Orçada
                      </span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {p.quantity.toLocaleString('pt-BR')} {p.productionUnit}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        Operações
                      </span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {opsCount} {opsCount === 1 ? 'etapa' : 'etapas'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        Custo Orçado
                      </span>
                      <span className="font-bold text-blue-700 tabular-nums">
                        {formatBRL(totalCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                        Custo Unitário
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formatBRLUnit(unitCost)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(p.budgetDate).toLocaleDateString('pt-BR')}</span>
                    {p.revisions && p.revisions.length > 0 && (
                      <span className="text-slate-300">· Rev. {p.currentRevisionNumber}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteClick(p.id)}
                      title="Excluir produto"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedProductId(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#00897B] bg-[#01B8AA]/10 hover:bg-[#01B8AA]/20 rounded-lg transition-colors"
                    >
                      <span>Abrir Orçamento</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal para Dados Básicos do Produto */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveProduct}
        initialProduct={editingProduct}
      />

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setProductToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Excluir Produto / Orçamento"
        message={
          deleteError ||
          'Deseja realmente excluir este produto? Se já houver apontamentos de produção registrados, a exclusão será bloqueada para preservar o histórico.'
        }
        type={deleteError ? 'warning' : 'danger'}
        confirmText={deleteError ? 'Entendido' : 'Confirmar Exclusão'}
        cancelText={deleteError ? 'Fechar' : 'Cancelar'}
      />
    </div>
  );
};
