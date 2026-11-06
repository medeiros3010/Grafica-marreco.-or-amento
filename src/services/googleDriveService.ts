/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StorageSnapshot } from './storage';

export const DRIVE_DATABASE_FILENAME = 'dados_grafica_database.json';

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export class GoogleDriveService {
  /**
   * Busca o arquivo de banco de dados pelo nome no Google Drive
   */
  async findDatabaseFile(accessToken: string): Promise<DriveFileInfo | null> {
    const query = `name = '${DRIVE_DATABASE_FILENAME}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id, name, modifiedTime, size)')}&spaces=drive`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      const errorText = await res.text();
      throw new Error(`Erro ao buscar arquivo no Google Drive: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0] as DriveFileInfo;
    }
    return null;
  }

  /**
   * Baixa e desserializa o snapshot do banco de dados do Google Drive
   */
  async downloadDatabaseFile(accessToken: string, fileId: string): Promise<StorageSnapshot> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      const errorText = await res.text();
      throw new Error(`Erro ao baixar banco do Google Drive: ${res.status} - ${errorText}`);
    }

    const json = await res.json();
    return json as StorageSnapshot;
  }

  /**
   * Cria o arquivo de banco de dados no Google Drive pela primeira vez via multipart upload
   */
  async createDatabaseFile(accessToken: string, snapshot: StorageSnapshot): Promise<DriveFileInfo> {
    const boundary = `-------MarrecoDriveBoundary${Date.now()}`;
    const metadata = {
      name: DRIVE_DATABASE_FILENAME,
      mimeType: 'application/json',
      description: 'Banco de dados sincronizado da Gráfica Marreco - Orçamentos, Insumos e Apontamentos',
    };

    const content = JSON.stringify(snapshot, null, 2);

    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      const errorText = await res.text();
      throw new Error(`Erro ao criar arquivo no Google Drive: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      modifiedTime: new Date().toISOString(),
    };
  }

  /**
   * Atualiza o conteúdo do arquivo existente no Google Drive via upload media PATCH
   */
  async updateDatabaseFile(accessToken: string, fileId: string, snapshot: StorageSnapshot): Promise<{ id: string }> {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const content = JSON.stringify(snapshot, null, 2);

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: content,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      const errorText = await res.text();
      throw new Error(`Erro ao atualizar arquivo no Google Drive: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return { id: data.id };
  }
}

export const googleDriveService = new GoogleDriveService();
