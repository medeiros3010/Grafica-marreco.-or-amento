/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Power,
  Layers,
  Clock,
  Coins,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { StandardTask, TaskSector, SECTOR_LABELS } from '../../types';
import { formatBRL, formatSecondsToTime } from '../../services/calculator';
import { TaskFormModal } from './TaskFormModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { storage } from '../../services/storage';

interface TasksViewProps {
  tasks: StandardTask[];
  onRefresh: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<TaskSector | 'ALL'>('ALL');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StandardTask | null>(null);

  // Dialog de erro de exclusão / confirmação
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogType, setDialogType] = useState<'danger' | 'warning' | 'info'>('warning');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.machine && t.machine.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSector = selectedSector === 'ALL' || t.sector === selectedSector;
    const matchesActive = !filterActiveOnly || t.active;
    return matchesSearch && matchesSector && matchesActive;
  });

  const handleCreate = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEdit = (task: StandardTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDuplicate = async (task: StandardTask) => {
    const newTask: StandardTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: `${task.code}-COP`,
      name: `${task.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveTask(newTask);
    onRefresh();
  };

  const handleToggleActive = async (task: StandardTask) => {
    await storage.toggleTaskActive(task.id, !task.active);
    onRefresh();
  };

  const handleDeleteClick = async (task: StandardTask) => {
    setTaskToDelete(task.id);
    setDialogTitle('Exclusão de Tarefa Padrão');
    setDialogMessage(
      `Deseja realmente remover permanentemente a tarefa "${task.code} - ${task.name}"?\n\nNota: Se a tarefa já tiver sido utilizada em algum produto ou histórico, o sistema impedirá a exclusão definitiva para proteger a rastreabilidade.`
    );
    setDialogType('danger');
    setDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    const res = await storage.deleteTask(taskToDelete);
    if (!res.success) {
      setDialogTitle('Operação Bloqueada para Preservação de Dados');
      setDialogMessage(
        res.error ||
          'Esta tarefa está vinculada ao histórico de produtos orçados. Utilize a opção "Inativar" para não afetar os cálculos anteriores.'
      );
      setDialogType('warning');
      setTaskToDelete(null);
      setDialogOpen(true);
    } else {
      setTaskToDelete(null);
      onRefresh();
    }
  };

  const handleSave = async (task: StandardTask) => {
    await storage.saveTask(task);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-[#374151]">Catálogo de Tarefas & Operações</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastre processos gráficos reutilizáveis com fórmulas de tempo (velocidade, lote ou unidade) e custos hora.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Tarefa Padrão
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Busca por código, nome ou máquina */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (ex: IMP-01), nome ou máquina..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#01B8AA] focus:border-[#01B8AA]"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterActiveOnly}
                onChange={(e) => setFilterActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-[#01B8AA] focus:ring-[#01B8AA]"
              />
              <span>Apenas ativas</span>
            </label>

            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-500 font-medium tabular-nums">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
        </div>

        {/* Abas de Setor (Filtro Segmentado) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedSector('ALL')}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedSector === 'ALL'
                ? 'bg-[#01B8AA] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Todos os Setores
          </button>
          {(Object.keys(SECTOR_LABELS) as TaskSector[]).map((sectorKey) => (
            <button
              key={sectorKey}
              onClick={() => setSelectedSector(sectorKey)}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedSector === sectorKey
                  ? 'bg-[#01B8AA] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {SECTOR_LABELS[sectorKey]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Tarefas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Código & Nome</th>
                <th className="py-3 px-4">Setor & Máquina</th>
                <th className="py-3 px-4">Modelo de Tempo</th>
                <th className="py-3 px-4">Prep. (Setup)</th>
                <th className="py-3 px-4 text-right">Taxa MO / Hora</th>
                <th className="py-3 px-4 text-right">Taxa Máq / Hora</th>
                <th className="py-3 px-4">Insumos</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium">Nenhuma tarefa encontrada para os filtros selecionados.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !task.active ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Código & Nome */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {task.code}
                      </div>
                      <div className="font-semibold text-slate-800 text-xs mt-0.5">
                        {task.name}
                      </div>
                      {task.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {task.description}
                        </div>
                      )}
                    </td>

                    {/* Setor & Máquina */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {SECTOR_LABELS[task.sector]}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                        {task.machine || 'Sem máquina fixa'}
                      </div>
                    </td>

                    {/* Modelo de Tempo */}
                    <td className="py-3 px-4">
                      {task.timeModel === 'MODELO_A' && (
                        <div>
                          <span className="font-semibold text-blue-700">Modelo A</span>
                          <span className="text-[11px] text-slate-500 block tabular-nums">
                            {task.speedPerHour?.toLocaleString('pt-BR')} {task.productionUnit}/h
                          </span>
                        </div>
                      )}
                      {task.timeModel === 'MODELO_B' && (
                        <div>
                          <span className="font-semibold text-indigo-700">Modelo B</span>
                          <span className="text-[11px] text-slate-500 block tabular-nums">
                            {formatSecondsToTime(task.batchTimeSeconds || 0)} / lote de {task.batchSize} {task.productionUnit}
                          </span>
                        </div>
                      )}
                      {task.timeModel === 'MODELO_C' && (
                        <div>
                          <span className="font-semibold text-emerald-700">Modelo C</span>
                          <span className="text-[11px] text-slate-500 block tabular-nums">
                            {task.unitTimeSeconds}s / {task.productionUnit}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Setup */}
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                      {formatSecondsToTime(task.setupTimeSeconds)}
                    </td>

                    {/* Taxas MO e Máquina */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {formatBRL(task.hourlyLaborRate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {formatBRL(task.hourlyMachineRate)}
                    </td>

                    {/* Insumos */}
                    <td className="py-3 px-4">
                      {task.materialName ? (
                        <div className="text-[11px]">
                          <span className="font-medium text-slate-700 truncate block max-w-xs">
                            {task.materialName}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {formatBRL(task.materialCostPerUnit)} / {task.materialUnit || 'un'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          task.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {task.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(task)}
                          title="Editar Parâmetros"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(task)}
                          title="Duplicar Tarefa"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(task)}
                          title={task.active ? 'Inativar Tarefa' : 'Ativar Tarefa'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            task.active
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(task)}
                          title="Excluir Tarefa (Protegida se utilizada)"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal de Formulário de Tarefa */}
      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialTask={editingTask}
      />

      {/* Confirmação e Aviso de Exclusão */}
      <ConfirmDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={dialogTitle}
        message={dialogMessage}
        type={dialogType}
        confirmText={taskToDelete ? 'Excluir Definitivamente' : 'Entendido'}
        cancelText={taskToDelete ? 'Cancelar' : 'Fechar'}
      />
    </div>
  );
};
