/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Copy,
  Check,
  FileJson,
  Code,
  Layers,
  Cpu,
  Package,
  FileSpreadsheet,
  ClipboardCheck,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);

  // Contadores ao vivo do banco de dados
  const [currentCounts, setCurrentCounts] = useState({
    machines: 0,
    materials: 0,
    tasks: 0,
    products: 0,
    revisions: 0,
    logs: 0,
    actualRecords: 0,
  });

  // Estado para inspeção do arquivo de restauração
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [restoreMode, setRestoreMode] = useState<'REPLACE' | 'MERGE'>('REPLACE');

  const updateCounts = () => {
    try {
      const counts = storage.getDatabaseCounts();
      setCurrentCounts(counts);
    } catch (e) {
      console.warn('Erro ao obter contadores do banco:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCounts();
      setSuccessMessage(null);
      setErrorMessage(null);
      setCopied(false);
      setParsedBackup(null);
    }
  }, [isOpen]);

  const handleExport = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const jsonString = await storage.exportBackup();

      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      a.href = url;
      a.download = `grafica_marreco_tudo_cadastrado_${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage(
        'Arquivo JSON com TUDO exportado com sucesso! Contém todas as máquinas, insumos, tarefas, produtos/orçamentos, revisões e apontamentos.'
      );
    } catch (e) {
      setErrorMessage(`Erro ao gerar arquivo de exportação: ${e instanceof Error ? e.message : 'Falha desconhecida'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const jsonString = await storage.exportBackup();
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setSuccessMessage('Estrutura JSON completa copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      setErrorMessage(`Erro ao copiar para área de transferência: ${e instanceof Error ? e.message : 'Falha desconhecida'}`);
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
        `Restauração concluída com sucesso (${restoreMode === 'REPLACE' ? 'Substituição total integral' : 'Mesclagem inteligente'}). Todos os dados foram atualizados no sistema!`
      );
      setParsedBackup(null);
      updateCounts();
      onDataChanged();
    } catch (e) {
      setErrorMessage(`Falha na restauração: ${e instanceof Error ? e.message : 'Erro no banco de dados'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSeed = async () => {
    if (
      window.confirm(
        'Deseja realmente restaurar os dados de demonstração originais? Isso redefinirá tarefas, catálogo e apontamentos de exemplo.'
      )
    ) {
      try {
        setLoading(true);
        await storage.resetToSeedData();
        setSuccessMessage('Dados de demonstração restaurados com sucesso!');
        updateCounts();
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
      title="Exportação Completa (Tudo Cadastrado em JSON Único)"
      subtitle="Exporta e importa 100% dos dados: Máquinas, Matérias-Primas, Tarefas Produtivas, Produtos & Orçamentos, Revisões, Chão de Fábrica e Apontamentos Reais."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Banner de Visão Geral da Base de Dados */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 border border-slate-700 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#01B8AA]/20 border border-[#01B8AA] flex items-center justify-center text-[#01B8AA]">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  Estrutura Unificada de Exportação da Gráfica Marreco
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Gera um único arquivo <code className="font-mono bg-slate-800 text-[#01B8AA] px-1 py-0.5 rounded">.json</code> estruturado com absolutamente tudo que você cadastrou no sistema.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Base Completa
            </span>
          </div>

          {/* Cards de Contagem ao Vivo da Base Atual */}
          <div className="pt-3 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-white tabular-nums">
                {currentCounts.machines}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Máquinas</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-white tabular-nums">
                {currentCounts.materials}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Insumos MP</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-white tabular-nums">
                {currentCounts.tasks}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Tarefas</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-emerald-400 tabular-nums">
                {currentCounts.products}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Orçamentos</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-white tabular-nums">
                {currentCounts.revisions}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Revisões</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-white tabular-nums">
                {currentCounts.logs}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Apontamentos</span>
            </div>
            <div className="bg-slate-800/90 rounded-lg p-2 border border-slate-700">
              <span className="block text-base font-bold text-amber-300 tabular-nums">
                {currentCounts.actualRecords}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Realizados</span>
            </div>
          </div>
        </div>

        {/* Feedback visual de sucesso ou erro */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#10B981] mt-0.5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444] mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* SEÇÃO 1: EXPORTAR TUDO */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#01B8AA]" />
                Exportar Tudo em Arquivo JSON Único
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Gera um arquivo completo com cabeçalho de integridade, contadores, configurações, máquinas, insumos, tarefas parametrizadas, produtos orçados com seus respectivos blocos A/B/C, revisões e chão de fábrica.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Copiar texto JSON integral para colar onde desejar"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#01B8AA] hover:bg-[#009E91] rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${loading ? 'animate-bounce' : ''}`} />
                <span>Baixar JSON Único (Tudo)</span>
              </button>
            </div>
          </div>

          {/* Toggle de Prévia do Schema JSON */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSchemaPreview(!showSchemaPreview)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#01B8AA] transition-colors cursor-pointer"
            >
              <Code className="w-3.5 h-3.5 text-slate-400" />
              <span>{showSchemaPreview ? 'Ocultar Estrutura do Arquivo (Schema)' : 'Visualizar Estrutura do Arquivo JSON (Schema & Chaves)'}</span>
              {showSchemaPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showSchemaPreview && (
              <div className="mt-3 p-3.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
                <pre>{`{
  "format": "GRAFICACUSTOS_BACKUP",
  "system": "Gráfica Marreco - Orçamento, Apontamento e Custos",
  "version": 4,
  "schemaVersion": "2.0",
  "exportedAt": "${new Date().toISOString()}",
  "summary": {
    "totalMachines": ${currentCounts.machines},
    "totalMaterials": ${currentCounts.materials},
    "totalTasks": ${currentCounts.tasks},
    "totalProducts": ${currentCounts.products},
    "totalRevisions": ${currentCounts.revisions},
    "totalProductionLogs": ${currentCounts.logs},
    "totalActualRecords": ${currentCounts.actualRecords}
  },
  "machines": [ /* id, nome, tipoCobranca, custoHora, custoMilheiro, active... */ ],
  "materials": [ /* id, nome, unidade, custoUnitario, active... */ ],
  "tasks": [ /* id, code, name, sector, timeModel, billingUnit, setup/speed, rates... */ ],
  "products": [ /* id, code, name, quantity, processos[], materials[], pricing{}, revisions[]... */ ],
  "logs": [ /* id, productId, operationId, operatorName, quantities, costs... */ ],
  "actualRecords": [ /* id, productId, materials[], processos[], tasks[], extras, margins... */ ]
}`}</pre>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 2: IMPORTAR E RESTAURAR ARQUIVO JSON */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 shadow-2xs">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Restaurar / Importar de Arquivo JSON
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Carregue um arquivo JSON gerado pelo sistema. Todos os registros serão validados antes de qualquer alteração na base.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-[#01B8AA] bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-semibold text-slate-700">
              Clique aqui para selecionar o arquivo .json
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Aceita backups integrais da Gráfica Marreco com todas as entidades
            </span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Prévia da Inspeção do Arquivo Selecionado */}
          {parsedBackup && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Arquivo Validado: Pronto para Restaurar
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">
                  Exportado em: {new Date(parsedBackup.exportedAt).toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Contadores dos Dados Encontrados no Arquivo */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.machines ?? (parsedBackup.machines?.length || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Máquinas</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.materials ?? (parsedBackup.materials?.length || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Insumos (MP)</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.tasks}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Tarefas Padrão</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-emerald-600 tabular-nums">
                    {parsedBackup.counts.products}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Orçamentos</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-slate-900 tabular-nums">
                    {parsedBackup.counts.logs}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Apontamentos</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-amber-200/90 shadow-2xs">
                  <span className="block text-base font-bold text-amber-700 tabular-nums">
                    {parsedBackup.counts.actualRecords ?? (parsedBackup.actualRecords?.length || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Realizados</span>
                </div>
              </div>

              {/* Modo de restauração */}
              <div className="bg-white/80 p-3.5 rounded-lg border border-amber-200/60 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Escolha o Modo de Aplicação no Sistema:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${restoreMode === 'REPLACE' ? 'bg-amber-50/80 border-amber-400 font-medium text-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input
                      type="radio"
                      name="restoreMode"
                      value="REPLACE"
                      checked={restoreMode === 'REPLACE'}
                      onChange={() => setRestoreMode('REPLACE')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="block text-slate-900">Substituição Integral</strong>
                      <span className="text-[11px] text-slate-500">Limpa a base atual e aplica exatamente o conteúdo do arquivo.</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${restoreMode === 'MERGE' ? 'bg-amber-50/80 border-amber-400 font-medium text-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input
                      type="radio"
                      name="restoreMode"
                      value="MERGE"
                      checked={restoreMode === 'MERGE'}
                      onChange={() => setRestoreMode('MERGE')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="block text-slate-900">Mesclagem Inteligente</strong>
                      <span className="text-[11px] text-slate-500">Mantém os registros existentes e adiciona/atualiza com os do arquivo.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ações da Restauração */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setParsedBackup(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Confirmar e Restaurar Banco
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SEÇÃO 3: REDEFINIR PARA FÁBRICA / DEMONSTRAÇÃO */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200">
          <span>Precisa reiniciar os exemplos de demonstração da gráfica?</span>
          <button
            type="button"
            onClick={handleResetSeed}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recarregar Dados Iniciais de Demonstração
          </button>
        </div>
      </div>
    </Modal>
  );
};
