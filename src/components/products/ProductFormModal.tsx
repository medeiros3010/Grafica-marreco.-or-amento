/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductStatus } from '../../types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => Promise<void>;
  initialProduct?: Product | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1000);
  const [productionUnit, setProductionUnit] = useState('Unidades');
  const [budgetDate, setBudgetDate] = useState(new Date().toISOString().slice(0, 10));
  const [deadlineDate, setDeadlineDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ProductStatus>('RASCUNHO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProduct) {
      setCode(initialProduct.code);
      setName(initialProduct.name);
      setClient(initialProduct.client || '');
      setDescription(initialProduct.description || '');
      setQuantity(initialProduct.quantity);
      setProductionUnit(initialProduct.productionUnit);
      setBudgetDate(initialProduct.budgetDate);
      setDeadlineDate(initialProduct.deadlineDate || '');
      setNotes(initialProduct.notes || '');
      setStatus(initialProduct.status);
    } else {
      const year = new Date().getFullYear();
      const randNum = Math.floor(100 + Math.random() * 900);
      setCode(`PRD-${year}-${randNum}`);
      setName('');
      setClient('');
      setDescription('');
      setQuantity(1000);
      setProductionUnit('Exemplares');
      setBudgetDate(new Date().toISOString().slice(0, 10));
      setDeadlineDate('');
      setNotes('');
      setStatus('RASCUNHO');
    }
    setError(null);
  }, [initialProduct, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Informe o código do produto/serviço.');
      return;
    }
    if (!name.trim()) {
      setError('Informe o nome descritivo do produto.');
      return;
    }
    if (!quantity || quantity <= 0) {
      setError('A quantidade orçada deve ser maior que zero.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await onSave({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        client: client.trim() || undefined,
        description: description.trim() || undefined,
        quantity: Number(quantity),
        productionUnit: productionUnit.trim() || 'Unidades',
        budgetDate,
        deadlineDate: deadlineDate || undefined,
        notes: notes.trim() || undefined,
        status,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProduct ? `Editar Dados: ${initialProduct.code}` : 'Cadastrar Novo Produto / Serviço Gráfico'}
      subtitle="Defina o escopo, cliente, tiragem orçada e datas previstas de entrega"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Código Único *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: PRD-2026-001"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Produto / Serviço *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Livro Fotográfico 96p, Caixa Cartucho Perfume, Catálogo A4"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cliente (Opcional)
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Ex: Editora Nexus Ltda"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tiragem / Quantidade Orçada *
            </label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unidade de Medida *
            </label>
            <input
              type="text"
              required
              value={productionUnit}
              onChange={(e) => setProductionUnit(e.target.value)}
              placeholder="Ex: Exemplares, Unidades, Caixas"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data do Orçamento *
            </label>
            <input
              type="date"
              required
              value={budgetDate}
              onChange={(e) => setBudgetDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prazo Previsto de Entrega
            </label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status Inicial
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="RASCUNHO">Rascunho</option>
              <option value="APROVADO">Aprovado</option>
              <option value="EM_PRODUCAO">Em Produção</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Especificações Técnicas / Descrição
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Formato aberto 420x297mm, miolo em couché fosco 150g, capa com reserva de verniz e laminação fosca."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Observações Comerciais / Produção
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Cliente autorizou variação de até 5% na tiragem final. Entrega no centro de distribuição em paletes padrão."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : initialProduct ? 'Salvar Alterações' : 'Criar Produto e Montar Orçamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
