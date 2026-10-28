/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial } from '../../types';
import { formatBRL } from '../../services/calculator';
import { Package } from 'lucide-react';

interface RawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: RawMaterial) => Promise<void>;
  initialMaterial?: RawMaterial | null;
}

const COMMON_UNITS = [
  'folha',
  'kg',
  'unidade',
  'm²',
  'milheiro',
  'litro',
  'bobina',
  'tubo',
  'pacote',
  'rolo',
];

export const RawMaterialModal: React.FC<RawMaterialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMaterial,
}) => {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('folha');
  const [custoUnitario, setCustoUnitario] = useState<number>(0.5);
  const [descricao, setDescricao] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMaterial) {
      setNome(initialMaterial.nome);
      setUnidade(initialMaterial.unidade);
      setCustoUnitario(initialMaterial.custoUnitario);
      setDescricao(initialMaterial.descricao || '');
      setActive(initialMaterial.active);
    } else {
      setNome('');
      setUnidade('folha');
      setCustoUnitario(0.5);
      setDescricao('');
      setActive(true);
    }
    setError(null);
  }, [initialMaterial, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Informe a descrição ou nome da matéria-prima.');
      return;
    }
    if (!unidade.trim()) {
      setError('Informe a unidade de medida (ex: kg, folha, unidade).');
      return;
    }
    if (custoUnitario < 0) {
      setError('O custo unitário não pode ser negativo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const materialData: RawMaterial = {
        id: initialMaterial ? initialMaterial.id : `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nome: nome.trim(),
        unidade: unidade.trim().toLowerCase(),
        custoUnitario: Number(custoUnitario),
        descricao: descricao.trim() || undefined,
        active,
        createdAt: initialMaterial ? initialMaterial.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(materialData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar matéria-prima');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialMaterial ? `Editar Insumo: ${initialMaterial.nome}` : 'Cadastrar Matéria-Prima (Insumo)'}
      subtitle="Cadastre o item com sua unidade de medida e custo de compra para uso no Bloco A do orçamento"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nome da Matéria-Prima / Insumo *
          </label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Papel Couché Brilho 150g (66x96cm), Tinta Escala Cyan"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unidade de Medida *
            </label>
            <div className="space-y-1.5">
              <input
                type="text"
                required
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex: folha, kg, unidade, m²"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
              <div className="flex flex-wrap gap-1">
                {COMMON_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnidade(u)}
                    className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                      unidade === u
                        ? 'bg-[#01B8AA] text-white border-[#01B8AA]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custo Unitário (R$ / {unidade || 'unidade'}) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-400 font-semibold">R$</span>
              <input
                type="number"
                step="0.0001"
                min={0}
                required
                value={custoUnitario}
                onChange={(e) => setCustoUnitario(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Valor de aquisição por {unidade || 'unidade'}.
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Descrição / Fornecedor / Observações (Opcional)
          </label>
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Fornecedor Suzano, pacote com 250 folhas, formato 66x96cm"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="materialActive"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded text-[#01B8AA] accent-[#01B8AA] cursor-pointer"
          />
          <label htmlFor="materialActive" className="text-xs font-medium text-slate-700 cursor-pointer">
            Insumo Ativo para Uso em Orçamentos
          </label>
        </div>

        {/* Resumo do custo unitário */}
        <div className="p-3 bg-[#01B8AA]/10 border border-[#01B8AA]/30 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Package className="w-4 h-4 text-[#01B8AA]" />
            <span className="font-medium">Custo Unitário Configurado:</span>
          </div>
          <span className="text-sm font-bold text-[#01B8AA] font-mono tabular-nums">
            {formatBRL(custoUnitario)} / {unidade || 'unidade'}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
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
            className="px-5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : initialMaterial ? 'Salvar Alterações' : 'Cadastrar Insumo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
