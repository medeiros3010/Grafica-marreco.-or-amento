/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RawMaterial } from '../../types';
import { formatBRL } from '../../services/calculator';
import { RawMaterialModal } from './RawMaterialModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface RawMaterialsViewProps {
  materials: RawMaterial[];
  onRefresh: () => void;
}

export const RawMaterialsView: React.FC<RawMaterialsViewProps> = ({ materials, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<RawMaterial | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredMaterials = materials.filter(
    (m) =>
      m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.descricao && m.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setIsModalOpen(true);
  };

  const handleSaveMaterial = async (material: RawMaterial) => {
    await storage.saveMaterial(material);
    onRefresh();
  };

  const handleToggleActive = async (material: RawMaterial) => {
    await storage.toggleMaterialActive(material.id, !material.active);
    onRefresh();
  };

  const handleOpenDelete = (material: RawMaterial) => {
    setMaterialToDelete(material);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!materialToDelete) return;
    const res = await storage.deleteMaterial(materialToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Não foi possível excluir esta matéria-prima.');
      return;
    }
    setDeleteConfirmOpen(false);
    setMaterialToDelete(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-[#01B8AA]" />
            Catálogo de Matérias-Primas (Insumos)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os papéis, tintas, filmes, vernizes e embalagens utilizados na produção para compor o Bloco A de custos do orçamento.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Insumo
        </button>
      </div>

      {deleteError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Barra de Filtro e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, unidade ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span>
            Total: <strong>{filteredMaterials.length}</strong> {filteredMaterials.length === 1 ? 'insumo' : 'insumos'}
          </span>
          <span>·</span>
          <span>
            Ativos: <strong className="text-emerald-700">{materials.filter((m) => m.active).length}</strong>
          </span>
        </div>
      </div>

      {/* Tabela Zebrada de Matérias-Primas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-5">Insumo / Matéria-Prima</th>
                <th className="py-3 px-5 text-center">Unidade</th>
                <th className="py-3 px-5 text-right">Custo Unitário (R$)</th>
                <th className="py-3 px-5">Detalhes / Aplicação</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium">Nenhum insumo encontrado</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cadastre novos materiais para alimentar os orçamentos de produtos.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat, index) => (
                  <tr
                    key={mat.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    {/* Nome do Insumo */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#01B8AA]/10 text-[#01B8AA] flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{mat.nome}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {mat.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Unidade */}
                    <td className="py-3.5 px-5 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium text-[11px]">
                        {mat.unidade}
                      </span>
                    </td>

                    {/* Custo Unitário */}
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      <span className="text-sm text-[#01B8AA]">{formatBRL(mat.custoUnitario)}</span>
                      <span className="text-[11px] text-slate-400 font-normal"> / {mat.unidade}</span>
                    </td>

                    {/* Descrição */}
                    <td className="py-3.5 px-5 max-w-xs">
                      <span className="text-slate-600 line-clamp-2">
                        {mat.descricao || <span className="text-slate-400 italic">Sem observações adicionais</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleToggleActive(mat)}
                        title={mat.active ? 'Clique para inativar insumo' : 'Clique para ativar insumo'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          mat.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {mat.active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(mat)}
                          title="Editar Insumo"
                          className="p-1.5 text-slate-400 hover:text-[#01B8AA] hover:bg-[#01B8AA]/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(mat)}
                          title="Excluir Insumo"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      <RawMaterialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMaterial}
        initialMaterial={editingMaterial}
      />

      {/* Confirmação de Exclusão */}
      {materialToDelete && (
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Excluir Matéria-Prima"
          message={`Tem certeza que deseja excluir o insumo "${materialToDelete.nome}"? Se ele estiver vinculado a produtos cadastrados, a exclusão será bloqueada para preservar o histórico.`}
          confirmText="Sim, Excluir"
          type="danger"
        />
      )}
    </div>
  );
};
