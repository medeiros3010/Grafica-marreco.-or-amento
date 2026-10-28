/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StandardTask, Product, ProductionLog, BudgetRevision, Machine, RawMaterial, ActualRecord } from '../types';
import {
  INITIAL_STANDARD_TASKS,
  INITIAL_PRODUCTS,
  INITIAL_PRODUCTION_LOGS,
  INITIAL_MACHINES,
  INITIAL_RAW_MATERIALS,
} from './seedData';

const DB_NAME = 'graficacustos_db_v1';
const DB_VERSION = 3;

interface AppMetadata {
  id: string;
  version: number;
  initializedAt: string;
  lastBackupAt?: string;
}

export interface BackupData {
  format: 'GRAFICACUSTOS_BACKUP';
  version: number;
  exportedAt: string;
  machines?: Machine[];
  materials?: RawMaterial[];
  tasks: StandardTask[];
  products: Product[];
  logs: ProductionLog[];
  actualRecords?: ActualRecord[];
  counts: {
    machines?: number;
    materials?: number;
    tasks: number;
    products: number;
    logs: number;
    actualRecords?: number;
  };
}

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  // Fallback em memória para ambientes sem IndexedDB nativo (ex: Node.js test runner)
  private memMachines: Map<string, Machine> = new Map();
  private memMaterials: Map<string, RawMaterial> = new Map();
  private memTasks: Map<string, StandardTask> = new Map();
  private memProducts: Map<string, Product> = new Map();
  private memLogs: Map<string, ProductionLog> = new Map();
  private memActualRecords: Map<string, ActualRecord> = new Map();
  private memInitialized = false;

  private initMemoryStorage() {
    if (this.memInitialized) return;
    for (const m of INITIAL_MACHINES) this.memMachines.set(m.id, { ...m });
    for (const mat of INITIAL_RAW_MATERIALS) this.memMaterials.set(mat.id, { ...mat });
    for (const t of INITIAL_STANDARD_TASKS) this.memTasks.set(t.id, { ...t });
    for (const p of INITIAL_PRODUCTS) this.memProducts.set(p.id, { ...p });
    for (const l of INITIAL_PRODUCTION_LOGS) this.memLogs.set(l.id, { ...l });
    this.memInitialized = true;
  }

  private hasIndexedDB(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.hasIndexedDB()) {
      throw new Error('IndexedDB não suportado neste ambiente.');
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Máquinas
        if (!db.objectStoreNames.contains('machines')) {
          const machineStore = db.createObjectStore('machines', { keyPath: 'id' });
          machineStore.createIndex('nome', 'nome', { unique: false });
          machineStore.createIndex('active', 'active', { unique: false });
        }

        // Matérias-Primas (Insumos)
        if (!db.objectStoreNames.contains('materials')) {
          const matStore = db.createObjectStore('materials', { keyPath: 'id' });
          matStore.createIndex('nome', 'nome', { unique: false });
          matStore.createIndex('active', 'active', { unique: false });
        }

        // Tarefas
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('code', 'code', { unique: true });
          taskStore.createIndex('sector', 'sector', { unique: false });
          taskStore.createIndex('active', 'active', { unique: false });
        }

        // Produtos
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('code', 'code', { unique: true });
          prodStore.createIndex('status', 'status', { unique: false });
        }

        // Logs
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('productId', 'productId', { unique: false });
          logStore.createIndex('operationId', 'operationId', { unique: false });
          logStore.createIndex('date', 'date', { unique: false });
        }

        // Apontamento Espelho (ActualRecord)
        if (!db.objectStoreNames.contains('actual_records')) {
          const actualStore = db.createObjectStore('actual_records', { keyPath: 'id' });
          actualStore.createIndex('productId', 'productId', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'id' });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        await this.checkAndSeed(db);
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('Erro ao abrir IndexedDB:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async checkAndSeed(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const storeNames = ['tasks', 'products', 'logs', 'metadata', 'machines', 'materials'];
      const tx = db.transaction(storeNames, 'readwrite');
      
      const machineStore = tx.objectStore('machines');
      const countMachReq = machineStore.count();
      countMachReq.onsuccess = () => {
        if (countMachReq.result === 0) {
          for (const m of INITIAL_MACHINES) {
            machineStore.put(m);
          }
        }
      };

      const matStore = tx.objectStore('materials');
      const countMatReq = matStore.count();
      countMatReq.onsuccess = () => {
        if (countMatReq.result === 0) {
          for (const mat of INITIAL_RAW_MATERIALS) {
            matStore.put(mat);
          }
        }
      };

      const taskStore = tx.objectStore('tasks');
      const countReq = taskStore.count();

      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          for (const task of INITIAL_STANDARD_TASKS) {
            taskStore.put(task);
          }
          const prodStore = tx.objectStore('products');
          for (const prod of INITIAL_PRODUCTS) {
            prodStore.put(prod);
          }
          const logStore = tx.objectStore('logs');
          for (const log of INITIAL_PRODUCTION_LOGS) {
            logStore.put(log);
          }
          const metaStore = tx.objectStore('metadata');
          metaStore.put({
            id: 'app_config',
            version: DB_VERSION,
            initializedAt: new Date().toISOString(),
          } as AppMetadata);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================
  // CADASTRO BÁSICO: MÁQUINAS
  // ==========================================

  async getAllMachines(): Promise<Machine[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memMachines.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('machines', 'readonly');
      const store = tx.objectStore('machines');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getMachineById(id: string): Promise<Machine | null> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return this.memMachines.get(id) || null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('machines', 'readonly');
      const store = tx.objectStore('machines');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMachine(machine: Machine): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memMachines.set(machine.id, { ...machine, updatedAt: new Date().toISOString() });
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('machines', 'readwrite');
      const store = tx.objectStore('machines');
      const request = store.put({
        ...machine,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMachine(id: string): Promise<{ success: boolean; error?: string }> {
    const tasks = await this.getAllTasks();
    const isUsed = tasks.some((t) => t.machineId === id || t.machine?.includes(id));
    if (isUsed) {
      return {
        success: false,
        error: 'Esta máquina está vinculada a tarefas cadastradas. Inative-a para preservar a integridade histórica.',
      };
    }

    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memMachines.delete(id);
      return { success: true };
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('machines', 'readwrite');
      const store = tx.objectStore('machines');
      const request = store.delete(id);
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  async toggleMachineActive(id: string, active: boolean): Promise<void> {
    const mach = await this.getMachineById(id);
    if (!mach) throw new Error('Máquina não encontrada');
    mach.active = active;
    await this.saveMachine(mach);
  }

  // ==========================================
  // CADASTRO BÁSICO: MATÉRIAS-PRIMAS (INSUMOS)
  // ==========================================

  async getAllMaterials(): Promise<RawMaterial[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memMaterials.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('materials', 'readonly');
      const store = tx.objectStore('materials');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getMaterialById(id: string): Promise<RawMaterial | null> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return this.memMaterials.get(id) || null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('materials', 'readonly');
      const store = tx.objectStore('materials');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMaterial(material: RawMaterial): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memMaterials.set(material.id, { ...material, updatedAt: new Date().toISOString() });
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('materials', 'readwrite');
      const store = tx.objectStore('materials');
      const request = store.put({
        ...material,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
    const products = await this.getAllProducts();
    const isUsed = products.some((p) =>
      p.materials?.some((m) => m.materialId === id)
    );
    if (isUsed) {
      return {
        success: false,
        error: 'Esta matéria-prima está em uso em orçamentos. Inative-a para preservar a integridade histórica.',
      };
    }

    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memMaterials.delete(id);
      return { success: true };
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('materials', 'readwrite');
      const store = tx.objectStore('materials');
      const request = store.delete(id);
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  async toggleMaterialActive(id: string, active: boolean): Promise<void> {
    const mat = await this.getMaterialById(id);
    if (!mat) throw new Error('Matéria-prima não encontrada');
    mat.active = active;
    await this.saveMaterial(mat);
  }

  // ==========================================
  // TAREFAS PADRÃO
  // ==========================================

  async getAllTasks(): Promise<StandardTask[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memTasks.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTaskById(id: string): Promise<StandardTask | null> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return this.memTasks.get(id) || null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task: StandardTask): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memTasks.set(task.id, { ...task, updatedAt: new Date().toISOString() });
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.put({
        ...task,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
    const products = await this.getAllProducts();
    const isUsed = products.some((p) => {
      const inDraft = p.draftOperations?.some((op) => op.taskId === id);
      const inRevisions = p.revisions?.some((rev) =>
        rev.operations?.some((op) => op.taskId === id)
      );
      return inDraft || inRevisions;
    });

    if (isUsed) {
      return {
        success: false,
        error:
          'Esta tarefa está vinculada ao histórico de produtos orçados. Para manter a rastreabilidade e histórico, inative a tarefa em vez de excluí-la.',
      };
    }

    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memTasks.delete(id);
      return { success: true };
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.delete(id);
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  }

  async toggleTaskActive(id: string, active: boolean): Promise<void> {
    const task = await this.getTaskById(id);
    if (!task) throw new Error('Tarefa não encontrada');
    task.active = active;
    await this.saveTask(task);
  }

  // ==========================================
  // PRODUTOS E ORÇAMENTOS
  // ==========================================

  async getAllProducts(): Promise<Product[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memProducts.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getProductById(id: string): Promise<Product | null> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return this.memProducts.get(id) || null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProduct(product: Product): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memProducts.set(product.id, { ...product, updatedAt: new Date().toISOString() });
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      const request = store.put({
        ...product,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
    const logs = await this.getLogsByProductId(id);
    const activeLogs = logs.filter((l) => !l.cancelled);
    if (activeLogs.length > 0) {
      return {
        success: false,
        error: `Não é possível excluir este produto pois existem ${activeLogs.length} apontamento(s) de produção registrados. Cancele o produto ou remova os apontamentos primeiro.`,
      };
    }

    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memProducts.delete(id);
      return { success: true };
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['products', 'logs'], 'readwrite');
      const prodStore = tx.objectStore('products');
      prodStore.delete(id);

      const logStore = tx.objectStore('logs');
      const index = logStore.index('productId');
      const req = index.openCursor(IDBKeyRange.only(id));
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve({ success: true });
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================
  // APONTAMENTOS DE PRODUÇÃO (REALIZADO)
  // ==========================================

  async getAllLogs(): Promise<ProductionLog[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memLogs.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readonly');
      const store = tx.objectStore('logs');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getLogsByProductId(productId: string): Promise<ProductionLog[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memLogs.values()).filter((l) => l.productId === productId);
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readonly');
      const store = tx.objectStore('logs');
      const index = store.index('productId');
      const request = index.getAll(productId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveLog(log: ProductionLog): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memLogs.set(log.id, { ...log });
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      const request = store.put(log);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cancelLog(id: string, reason: string): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      const log = this.memLogs.get(id);
      if (log) {
        log.cancelled = true;
        log.cancelledAt = new Date().toISOString();
        log.cancelledReason = reason;
      }
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const log = getReq.result as ProductionLog | undefined;
        if (!log) {
          reject(new Error('Apontamento não encontrado'));
          return;
        }
        log.cancelled = true;
        log.cancelledAt = new Date().toISOString();
        log.cancelledReason = reason;

        const putReq = store.put(log);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  // ==========================================
  // APONTAMENTO REALIZADO (LAYOUT ESPELHO - ACTUAL RECORD)
  // ==========================================

  async saveActualRecord(record: ActualRecord): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      this.memActualRecords.set(record.id, { ...record });
      const prod = this.memProducts.get(record.productId);
      if (prod) {
        prod.actualRecord = record;
        if (prod.materials) {
          prod.materials = prod.materials.map((m) => {
            const act = record.materials.find(
              (rm) => rm.materialItemId === m.id || rm.nome.toLowerCase() === m.nome.toLowerCase()
            );
            if (act) {
              return {
                ...m,
                quantidadeReal: act.quantidadeReal,
                custoUnitarioReal: act.custoUnitarioReal,
                totalCustoReal: act.totalCustoReal,
              };
            }
            return m;
          });
        }
      }
      return;
    }

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('actual_records', 'readwrite');
      const store = tx.objectStore('actual_records');
      const request = store.put({
        ...record,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Atualiza também no produto para sincronização direta
    const product = await this.getProductById(record.productId);
    if (product) {
      product.actualRecord = record;
      if (product.materials) {
        product.materials = product.materials.map((m) => {
          const act = record.materials.find(
            (rm) => rm.materialItemId === m.id || rm.nome.toLowerCase() === m.nome.toLowerCase()
          );
          if (act) {
            return {
              ...m,
              quantidadeReal: act.quantidadeReal,
              custoUnitarioReal: act.custoUnitarioReal,
              totalCustoReal: act.totalCustoReal,
            };
          }
          return m;
        });
      }
      if (product.activeRevision?.materials) {
        product.activeRevision.materials = product.activeRevision.materials.map((m) => {
          const act = record.materials.find(
            (rm) => rm.materialItemId === m.id || rm.nome.toLowerCase() === m.nome.toLowerCase()
          );
          if (act) {
            return {
              ...m,
              quantidadeReal: act.quantidadeReal,
              custoUnitarioReal: act.custoUnitarioReal,
              totalCustoReal: act.totalCustoReal,
            };
          }
          return m;
        });
      }
      await this.saveProduct(product);
    }
  }

  async getActualRecordByProduct(productId: string): Promise<ActualRecord | null> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      for (const r of this.memActualRecords.values()) {
        if (r.productId === productId) return r;
      }
      const prod = this.memProducts.get(productId);
      return prod?.actualRecord || null;
    }

    const product = await this.getProductById(productId);
    if (product?.actualRecord) {
      return product.actualRecord;
    }

    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('actual_records')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('actual_records', 'readonly');
        const store = tx.objectStore('actual_records');
        const index = store.index('productId');
        const req = index.getAll(productId);
        req.onsuccess = () => {
          const list = req.result as ActualRecord[] | undefined;
          if (list && list.length > 0) {
            resolve(list[list.length - 1]);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async getAllActualRecords(): Promise<ActualRecord[]> {
    if (!this.hasIndexedDB()) {
      this.initMemoryStorage();
      return Array.from(this.memActualRecords.values());
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        if (!db.objectStoreNames.contains('actual_records')) {
          resolve([]);
          return;
        }
        const tx = db.transaction('actual_records', 'readonly');
        const store = tx.objectStore('actual_records');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch {
        resolve([]);
      }
    });
  }

  // ==========================================
  // BACKUP COMPLETO E RESTAURAÇÃO (JSON)
  // ==========================================

  async exportBackup(): Promise<string> {
    const [machines, materials, tasks, products, logs, actualRecords] = await Promise.all([
      this.getAllMachines(),
      this.getAllMaterials(),
      this.getAllTasks(),
      this.getAllProducts(),
      this.getAllLogs(),
      this.getAllActualRecords(),
    ]);

    const backup: BackupData = {
      format: 'GRAFICACUSTOS_BACKUP',
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      machines,
      materials,
      tasks,
      products,
      logs,
      actualRecords,
      counts: {
        machines: machines.length,
        materials: materials.length,
        tasks: tasks.length,
        products: products.length,
        logs: logs.length,
        actualRecords: actualRecords.length,
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  validateBackup(jsonString: string): { valid: boolean; data?: BackupData; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.format !== 'GRAFICACUSTOS_BACKUP') {
        return {
          valid: false,
          error: 'Formato de arquivo incompatível. O arquivo deve ser um backup gerado pela Gráfica Marreco.',
        };
      }
      if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.products) || !Array.isArray(parsed.logs)) {
        return {
          valid: false,
          error: 'Estrutura corrompida: coleções de tarefas, produtos ou apontamentos ausentes.',
        };
      }
      return {
        valid: true,
        data: parsed as BackupData,
      };
    } catch (e) {
      return {
        valid: false,
        error: `Arquivo JSON inválido: ${e instanceof Error ? e.message : 'Falha na leitura'}`,
      };
    }
  }

  async restoreBackup(backup: BackupData, mode: 'REPLACE' | 'MERGE'): Promise<void> {
    if (!this.hasIndexedDB()) {
      if (mode === 'REPLACE') {
        this.memMachines.clear();
        this.memMaterials.clear();
        this.memTasks.clear();
        this.memProducts.clear();
        this.memLogs.clear();
      }
      if (backup.machines) for (const m of backup.machines) this.memMachines.set(m.id, m);
      if (backup.materials) for (const mat of backup.materials) this.memMaterials.set(mat.id, mat);
      for (const t of backup.tasks) this.memTasks.set(t.id, t);
      for (const p of backup.products) this.memProducts.set(p.id, p);
      for (const l of backup.logs) this.memLogs.set(l.id, l);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['machines', 'materials', 'tasks', 'products', 'logs'], 'readwrite');
      const machStore = tx.objectStore('machines');
      const matStore = tx.objectStore('materials');
      const taskStore = tx.objectStore('tasks');
      const prodStore = tx.objectStore('products');
      const logStore = tx.objectStore('logs');

      if (mode === 'REPLACE') {
        machStore.clear();
        matStore.clear();
        taskStore.clear();
        prodStore.clear();
        logStore.clear();
      }

      if (backup.machines) {
        for (const m of backup.machines) machStore.put(m);
      }
      if (backup.materials) {
        for (const mat of backup.materials) matStore.put(mat);
      }
      for (const t of backup.tasks) {
        taskStore.put(t);
      }
      for (const p of backup.products) {
        prodStore.put(p);
      }
      for (const l of backup.logs) {
        logStore.put(l);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async resetToSeedData(): Promise<void> {
    if (!this.hasIndexedDB()) {
      this.memMachines.clear();
      this.memMaterials.clear();
      this.memTasks.clear();
      this.memProducts.clear();
      this.memLogs.clear();
      this.memInitialized = false;
      this.initMemoryStorage();
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['machines', 'materials', 'tasks', 'products', 'logs'], 'readwrite');
      const machStore = tx.objectStore('machines');
      const matStore = tx.objectStore('materials');
      const taskStore = tx.objectStore('tasks');
      const prodStore = tx.objectStore('products');
      const logStore = tx.objectStore('logs');

      machStore.clear();
      matStore.clear();
      taskStore.clear();
      prodStore.clear();
      logStore.clear();

      for (const mach of INITIAL_MACHINES) {
        machStore.put(mach);
      }
      for (const mat of INITIAL_RAW_MATERIALS) {
        matStore.put(mat);
      }
      for (const task of INITIAL_STANDARD_TASKS) {
        taskStore.put(task);
      }
      for (const prod of INITIAL_PRODUCTS) {
        prodStore.put(prod);
      }
      for (const log of INITIAL_PRODUCTION_LOGS) {
        logStore.put(log);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const storage = new StorageService();
