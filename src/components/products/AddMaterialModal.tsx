/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RawMaterial, ProductMaterialItem } from '../../types';
import { storage } from '../../services/storage';
import { formatBRL } from '../../services/calculator';
import { X, Package, Plus, Calculator } from 'lucide-react';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMaterial: (material: ProductMaterialItem) => void;
  initialMaterial?: ProductMaterialItem | null;
}

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  onClose,
  onSaveMaterial,
  initialMaterial,
}) => {
  const [catalogMaterials, setCatalogMaterials] = useState<RawMaterial[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('folha');
  const [quantidade, setQuantidade] = useState<number>(1000);
  const [custoUnitario, setCustoUnitario] = useState<number>(0.5);

  useEffect(() => {
    if (isOpen) {
      storage.getAllMaterials().then((mats) => {
        setCatalogMaterials(mats);
      });

      if (initialMaterial) {
        setSelectedCatalogId(initialMaterial.materialId || '');
        setNome(initialMaterial.nome);
        setUnidade(initialMaterial.unidade);
        setQuantidade(initialMaterial.quantidade);
        setCustoUnitario(initialMaterial.custoUnitario);
      } else {
        setSelectedCatalogId('');
        setNome('');
        setUnidade('folha');
        setQuantidade(1000);
        setCustoUnitario(0.45);
      }
    }
  }, [isOpen, initialMaterial]);

  if (!isOpen) return null;

  const handleSelectCatalogItem = (materialId: string) => {
    setSelectedCatalogId(materialId);
    const found = catalogMaterials.find((m) => m.id === materialId);
    if (found) {
      setNome(found.nome);
      setUnidade(found.unidade);
      setCustoUnitario(found.custoUnitario);
    }
  };

  const calculatedTotal = Number(((quantidade || 0) * (custoUnitario || 0)).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe o nome da matéria-prima.');
      return;
    }
    if (quantidade <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }
    if (custoUnitario < 0) {
      alert('O custo unitário não pode ser negativo.');
      return;
    }

    const item: ProductMaterialItem = {
      id: initialMaterial?.id || `mat_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      materialId: selectedCatalogId || undefined,
      nome: nome.trim(),
      unidade: unidade.trim() || 'un',
      quantidade: Number(quantidade),
      custoUnitario: Number(custoUnitario),
      totalCusto: calculatedTotal,
      quantidadeReal: initialMaterial?.quantidadeReal,
      custoUnitarioReal: initialMaterial?.custoUnitarioReal,
      totalCustoReal: initialMaterial?.totalCustoReal,
    };

    onSaveMaterial(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#01B8AA]" />
            <h3 className="text-sm font-bold text-[#374151]">
              {initialMaterial ? 'Editar Matéria-Prima (Bloco A)' : 'Adicionar Matéria-Prima ao Orçamento'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seletor rápido a partir do Catálogo */}
          {catalogMaterials.length > 0 && !initialMaterial && (
            <div className="p-3 bg-teal-50/50 border border-teal-200/60 rounded-lg">
              <label className="block text-xs font-semibold text-[#00897B] mb-1">
                Importar do Catálogo de Insumos:
              </label>
              <select
                value={selectedCatalogId}
                onChange={(e) => handleSelectCatalogItem(e.target.value)}
                className="w-full text-xs bg-white border border-teal-300 rounded-md p-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#01B8AA]"
              >
                <option value="">-- Selecione ou digite manualmente abaixo --</option>
                {catalogMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.nome} ({mat.unidade}) - {formatBRL(mat.custoUnitario)}/{mat.unidade}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nome do Insumo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nome da Matéria-Prima / Insumo *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Papel Cartão Triplex 300g"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Unidade */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unidade de Medida *
              </label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#01B8AA] bg-white"
              >
                <option value="folha">folha</option>
                <option value="kg">kg</option>
                <option value="unidade">unidade</option>
                <option value="m²">m²</option>
                <option value="metro">metro</option>
                <option value="milheiro">milheiro</option>
                <option value="lata">lata</option>
                <option value="tubo">tubo</option>
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Quantidade Prevista *
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Custo Unitário */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Custo Unitário (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-semibold text-gray-400">R$</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
                />
              </div>
            </div>

            {/* Total Calculado = Qtd * Custo Unitário */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Total Previsto (Qtd × Custo Unit)
              </label>
              <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold font-mono text-[#00897B] flex items-center justify-between">
                <span>{formatBRL(calculatedTotal)}</span>
                <Calculator className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              {initialMaterial ? 'Atualizar Insumo' : 'Salvar no Orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
