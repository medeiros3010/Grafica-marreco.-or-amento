/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { TasksView } from './components/tasks/TasksView';
import { ProductsView } from './components/products/ProductsView';
import { ProductionLogsView } from './components/logs/ProductionLogsView';
import { ComparisonView } from './components/analysis/ComparisonView';
import { MachinesView } from './components/machines/MachinesView';
import { RawMaterialsView } from './components/materials/RawMaterialsView';
import { BackupModal } from './components/common/BackupModal';
import { TestsModal } from './components/common/TestsModal';
import { storage } from './services/storage';
import { StandardTask, Product, ProductionLog, Machine, RawMaterial } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [tasks, setTasks] = useState<StandardTask[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modais utilitários
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isTestsOpen, setIsTestsOpen] = useState(false);

  const loadAllData = async () => {
    try {
      const [allMachines, allMaterials, allTasks, allProducts, allLogs] = await Promise.all([
        storage.getAllMachines(),
        storage.getAllMaterials(),
        storage.getAllTasks(),
        storage.getAllProducts(),
        storage.getAllLogs(),
      ]);
      setMachines(allMachines);
      setMaterials(allMaterials);
      setTasks(allTasks);
      setProducts(allProducts);
      setLogs(allLogs);

      // Se nenhum produto estiver selecionado, seleciona o primeiro
      if (!selectedProductId && allProducts.length > 0) {
        setSelectedProductId(allProducts[0].id);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do IndexedDB:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleGoToLogs = (productId: string) => {
    setSelectedProductId(productId);
    setActiveTab('logs');
  };

  const handleGoToAnalysis = (productId: string) => {
    setSelectedProductId(productId);
    setActiveTab('analysis');
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#01B8AA]" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Inicializando sistema da Gráfica Marreco...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F3F4F6] font-sans antialiased text-[#374151]">
      {/* Menu Lateral de Navegação */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenTests={() => setIsTestsOpen(true)}
        counts={{
          machines: machines.length,
          materials: materials.length,
          tasks: tasks.length,
          products: products.length,
          logs: logs.filter((l) => !l.cancelled).length,
        }}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra Superior de Contexto */}
        <Header
          activeTab={activeTab}
          currentProductTitle={
            activeTab === 'logs' || activeTab === 'analysis'
              ? selectedProduct
                ? `${selectedProduct.code} - ${selectedProduct.name}`
                : undefined
              : undefined
          }
        />

        {/* Viewport de Conteúdo com Rolagem */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                products={products}
                logs={logs}
                tasks={tasks}
                onSelectProduct={(id) => {
                  setSelectedProductId(id);
                  setActiveTab('products');
                }}
                onGoToAnalysis={handleGoToAnalysis}
                onGoToLogs={handleGoToLogs}
              />
            )}

            {activeTab === 'machines' && (
              <MachinesView machines={machines} onRefresh={loadAllData} />
            )}

            {activeTab === 'materials' && (
              <RawMaterialsView materials={materials} onRefresh={loadAllData} />
            )}

            {activeTab === 'tasks' && (
              <TasksView tasks={tasks} onRefresh={loadAllData} />
            )}

            {activeTab === 'products' && (
              <ProductsView
                products={products}
                standardTasks={tasks}
                onRefresh={loadAllData}
                onGoToLogs={handleGoToLogs}
                onGoToAnalysis={handleGoToAnalysis}
              />
            )}

            {activeTab === 'logs' && (
              <ProductionLogsView
                products={products}
                logs={logs}
                selectedProductId={selectedProductId}
                onSelectProduct={setSelectedProductId}
                onRefresh={loadAllData}
                onGoToAnalysis={handleGoToAnalysis}
              />
            )}

            {activeTab === 'analysis' && (
              <ComparisonView
                products={products}
                logs={logs}
                selectedProductId={selectedProductId}
                onSelectProduct={setSelectedProductId}
                onGoToLogs={handleGoToLogs}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modal de Backup e Restauração de Dados em JSON */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onDataChanged={loadAllData}
      />

      {/* Modal Interativo com a Bateria de 10 Testes Mandatórios */}
      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
      />
    </div>
  );
}
