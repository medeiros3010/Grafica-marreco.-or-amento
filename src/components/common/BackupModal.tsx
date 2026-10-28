/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Upload, Database, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { storage, BackupData } from '../../services/storage';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Estado para inspeção do arquivo de restauração
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [restoreMode, setRestoreMode] = useState<'REPLACE' | 'MERGE'>('REPLACE');

  const handleExport = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const jsonString = await storage.exportBackup();
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup_grafica_marreco_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage('Arquivo de backup exportado com sucesso!');
    } catch (e) {
      setErrorMessage(`Erro ao gerar backup: ${e instanceof Error ? e.message : 'Falha desconhecida'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setParsedBackup(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = storage.validateBackup(content);
      if (!validation.valid || !validation.data) {
        setErrorMessage(validation.error || 'Arquivo de backup inválido.');
        return;
      }
      setParsedBackup(validation.data);
    };
    reader.onerror = () => {
      setErrorMessage('Falha ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!parsedBackup) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      await storage.restoreBackup(parsedBackup, restoreMode);
      setSuccessMessage(
        `Restauração concluída com sucesso (${restoreMode === 'REPLACE' ? 'Substituição total' : 'Mesclagem'}).`
      );
      setParsedBackup(null);
      onDataChanged();
    } catch (e) {
      setErrorMessage(`Falha na restauração: ${e instanceof Error ? e.message : 'Erro no banco de dados'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSeed = async () => {
    if (window.confirm('Deseja realmente restaurar os dados de demonstração originais? Isso redefinirá tarefas, catálogo e apontamentos de exemplo.')) {
      try {
        setLoading(true);
        await storage.resetToSeedData();
        setSuccessMessage('Dados de demonstração restaurados com sucesso!');
        onDataChanged();
      } catch (e) {
        setErrorMessage('Falha ao restaurar dados de fábrica.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Armazenamento Local & Backup de Segurança"
      subtitle="Gerenciamento de dados persistidos no navegador via IndexedDB"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Aviso de Armazenamento Local Mandatório */}
        <div className="bg-[#01B8AA]/10 border border-[#01B8AA]/30 rounded-xl p-4 flex gap-3 text-xs text-slate-700">
          <Database className="w-5 h-5 text-[#01B8AA] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Armazenamento 100% Local (IndexedDB)
            </p>
            <p>
              Todos os cadastros, orçamentos e apontamentos são gravados com segurança na memória do seu navegador. Os dados permanecem preservados ao fechar e reabrir a janela, mas <strong>não são sincronizados automaticamente entre computadores diferentes</strong>.
            </p>
            <p className="text-slate-600">
              Utilize o backup em arquivo JSON abaixo para transferir dados para outra máquina ou criar cópias de segurança periódicas.
            </p>
          </div>
        </div>

        {/* Feedback visual */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#10B981]" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Seção 1: Exportar Backup */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Exportar Backup Completo</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Gera um arquivo JSON contendo tarefas padrão, orçamentos, revisões e histórico de apontamentos.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 shadow-xs"
            >
              <Download className="w-4 h-4" />
              Baixar Arquivo JSON
            </button>
          </div>
        </div>

        {/* Seção 2: Importar e Restaurar Backup */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Restaurar a partir de Arquivo JSON</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione um arquivo de backup previamente exportado. O sistema inspecionará o conteúdo antes de qualquer alteração.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-[#01B8AA] bg-slate-50/50 transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-medium text-slate-700">Clique para selecionar o arquivo .json</span>
            <span className="text-[11px] text-slate-400">Suporta arquivos gerados pela Gráfica Marreco</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Prévia da Inspeção do Backup */}
          {parsedBackup && (
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                  Prévia de Dados do Arquivo
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  Exportado em: {new Date(parsedBackup.exportedAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded border border-amber-200">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.tasks}
                  </span>
                  <span className="text-[11px] text-slate-500">Tarefas Padrão</span>
                </div>
                <div className="p-2 bg-white rounded border border-amber-200">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.products}
                  </span>
                  <span className="text-[11px] text-slate-500">Produtos</span>
                </div>
                <div className="p-2 bg-white rounded border border-amber-200">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.logs}
                  </span>
                  <span className="text-[11px] text-slate-500">Apontamentos</span>
                </div>
              </div>

              {/* Modo de restauração */}
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Modo de Aplicação:
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="REPLACE"
                      checked={restoreMode === 'REPLACE'}
                      onChange={() => setRestoreMode('REPLACE')}
                    />
                    <span>Substituir tudo (Limpar base atual e aplicar o backup)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="MERGE"
                      checked={restoreMode === 'MERGE'}
                      onChange={() => setRestoreMode('MERGE')}
                    />
                    <span>Mesclar (Adicionar/Atualizar registros existentes)</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setParsedBackup(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg disabled:opacity-50"
                >
                  Confirmar e Restaurar Banco
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Seção 3: Redefinir para Demonstração */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
          <span>Precisa reiniciar os exemplos de teste?</span>
          <button
            type="button"
            onClick={handleResetSeed}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar Dados Iniciais de Demonstração
          </button>
        </div>
      </div>
    </Modal>
  );
};
