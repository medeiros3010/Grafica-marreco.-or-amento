/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Machine } from '../../types';
import { formatBRL } from '../../services/calculator';
import { MachineModal } from './MachineModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';
import {
  Cpu,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Layers,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface MachinesViewProps {
  machines: Machine[];
  onRefresh: () => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({ machines, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredMachines = machines.filter(
    (m) =>
      m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.descricao && m.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setEditingMachine(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setIsModalOpen(true);
  };

  const handleSaveMachine = async (machine: Machine) => {
    await storage.saveMachine(machine);
    onRefresh();
  };

  const handleToggleActive = async (machine: Machine) => {
    await storage.toggleMachineActive(machine.id, !machine.active);
    onRefresh();
  };

  const handleOpenDelete = (machine: Machine) => {
    setMachineToDelete(machine);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!machineToDelete) return;
    const res = await storage.deleteMachine(machineToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Não foi possível excluir esta máquina.');
      return;
    }
    setDeleteConfirmOpen(false);
    setMachineToDelete(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#01B8AA]" />
            Parque Gráfico & Máquinas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os equipamentos produtivos e seus respectivos custos por hora. O valor será herdado diretamente pelas tarefas.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Máquina
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
            placeholder="Buscar por nome, modelo ou especificação técnica..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA]"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span>
            Total: <strong>{filteredMachines.length}</strong> {filteredMachines.length === 1 ? 'máquina' : 'máquinas'}
          </span>
          <span>·</span>
          <span>
            Ativas: <strong className="text-emerald-700">{machines.filter((m) => m.active).length}</strong>
          </span>
        </div>
      </div>

      {/* Tabela Zebrada de Máquinas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-5">Máquina / Equipamento</th>
                <th className="py-3 px-5 text-right">Custo Hora (R$/h)</th>
                <th className="py-3 px-5">Descrição / Aplicação</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Cpu className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium">Nenhuma máquina encontrada</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cadastre novos equipamentos para alimentar os cálculos de custo/hora nas tarefas.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMachines.map((mach, index) => (
                  <tr
                    key={mach.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      index % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    {/* Nome da Máquina */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#01B8AA]/10 text-[#01B8AA] flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{mach.nome}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {mach.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Custo Hora */}
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      <span className="text-sm text-[#01B8AA]">{formatBRL(mach.custoHora)}</span>
                      <span className="text-[11px] text-slate-400 font-normal"> / hora</span>
                    </td>

                    {/* Descrição */}
                    <td className="py-3.5 px-5 max-w-xs">
                      <span className="text-slate-600 line-clamp-2">
                        {mach.descricao || <span className="text-slate-400 italic">Sem descrição técnica</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleToggleActive(mach)}
                        title={mach.active ? 'Clique para inativar máquina' : 'Clique para ativar máquina'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          mach.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {mach.active ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Ativa
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inativa
                          </>
                        )}
                      </button>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(mach)}
                          title="Editar Máquina"
                          className="p-1.5 text-slate-400 hover:text-[#01B8AA] hover:bg-[#01B8AA]/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(mach)}
                          title="Excluir Máquina"
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
      <MachineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMachine}
        initialMachine={editingMachine}
      />

      {/* Confirmação de Exclusão */}
      {machineToDelete && (
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Excluir Máquina"
          message={`Tem certeza que deseja remover a máquina "${machineToDelete.nome}"? Se ela estiver vinculada a tarefas, a exclusão será bloqueada para preservar o histórico.`}
          confirmText="Sim, Excluir"
          type="danger"
        />
      )}
    </div>
  );
};
