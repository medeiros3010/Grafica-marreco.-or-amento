/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProductMaterialItem } from '../../types';
import { formatBRL } from '../../services/calculator';
import { X, Package, Check } from 'lucide-react';

interface ActualMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialItem: ProductMaterialItem | null;
  onSave: (updatedItem: ProductMaterialItem) => void;
}

export const ActualMaterialModal: React.FC<ActualMaterialModalProps> = ({
  isOpen,
  onClose,
  materialItem,
  onSave,
}) => {
  const [quantidadeReal, setQuantidadeReal] = useState<number>(0);
  const [custoUnitarioReal, setCustoUnitarioReal] = useState<number>(0);

  useEffect(() => {
    if (materialItem) {
      setQuantidadeReal(
        materialItem.quantidadeReal !== undefined
          ? materialItem.quantidadeReal
          : materialItem.quantidade
      );
      setCustoUnitarioReal(
        materialItem.custoUnitarioReal !== undefined
          ? materialItem.custoUnitarioReal
          : materialItem.custoUnitario
      );
    }
  }, [materialItem]);

  if (!isOpen || !materialItem) return null;

  const totalCustoReal = Number((quantidadeReal * custoUnitarioReal).toFixed(2));
  const diferenca = Number((totalCustoReal - materialItem.totalCusto).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...materialItem,
      quantidadeReal,
      custoUnitarioReal,
      totalCustoReal,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#01B8AA]" />
            <h3 className="text-sm font-bold text-[#374151]">
              Apontar Consumo Real de Insumo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-gray-700">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">
              Insumo Orçado
            </span>
            <div className="text-sm font-bold text-gray-800 mt-0.5">{materialItem.nome}</div>
            <div className="text-xs text-gray-500 mt-1">
              Previsto: {materialItem.quantidade.toLocaleString('pt-BR')} {materialItem.unidade} × {formatBRL(materialItem.custoUnitario)} ={' '}
              <strong className="text-gray-700">{formatBRL(materialItem.totalCusto)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Qtd. Efetivamente Consumida ({materialItem.unidade}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={quantidadeReal}
                onChange={(e) => setQuantidadeReal(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Custo Unitário Real (R$) *
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                required
                value={custoUnitarioReal}
                onChange={(e) => setCustoUnitarioReal(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-gray-50 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Custo Real Total
              </span>
              <span className="text-base font-bold font-mono text-gray-900">
                {formatBRL(totalCustoReal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Desvio vs Orçado
              </span>
              <span
                className={`text-sm font-bold font-mono ${
                  diferenca > 0 ? 'text-[#EF4444]' : diferenca < 0 ? 'text-[#10B981]' : 'text-gray-700'
                }`}
              >
                {diferenca > 0 ? `+${formatBRL(diferenca)}` : formatBRL(diferenca)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm"
            >
              <Check className="w-4 h-4" />
              Salvar Apontamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
