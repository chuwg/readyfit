import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

const TABLES = [
  'user_profile',
  'shift_config',
  'morning_report_config',
  'supplements',
  'supplement_base_times',
  'shoes',
  'basketball_config',
  'running_sessions',
  'basketball_sessions',
  'inbody_records',
  'sleep_records',
  'daily_scores',
] as const;

export const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: number;
  app: 'fitlog';
  tables: Record<string, unknown[]>;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  return SQLite.openDatabaseAsync('fitlog.db');
}

async function dumpAll(): Promise<BackupFile> {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    try {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${t}`,
      );
      tables[t] = rows;
    } catch {
      tables[t] = [];
    }
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    app: 'fitlog',
    tables,
  };
}

function backupFileName(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `fitlog-backup-${y}${m}${day}-${hh}${mm}.json`;
}

export interface ExportResult {
  shared: boolean;
  fileUri: string;
  size: number;
}

export async function exportToFile(): Promise<ExportResult> {
  const data = await dumpAll();
  const json = JSON.stringify(data, null, 2);
  const fileUri = `${FileSystem.cacheDirectory}${backupFileName()}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: '레디핏 백업 파일 공유',
      UTI: 'public.json',
    });
    return { shared: true, fileUri, size: json.length };
  }
  return { shared: false, fileUri, size: json.length };
}

function isBackupShape(obj: unknown): obj is BackupFile {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    o.app === 'fitlog' &&
    typeof o.version === 'number' &&
    o.tables !== null &&
    typeof o.tables === 'object'
  );
}

export interface ImportSummary {
  tables: Record<string, number>;
  exportedAt: number | null;
}

export async function pickAndImport(): Promise<ImportSummary> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets[0]) {
    throw new Error('CANCELED');
  }
  const uri = picked.assets[0].uri;
  const text = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = JSON.parse(text);
  if (!isBackupShape(parsed)) {
    throw new Error('INVALID_FORMAT');
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error('VERSION_TOO_NEW');
  }

  const db = await getDb();
  const summary: Record<string, number> = {};

  await db.execAsync('BEGIN');
  try {
    for (const t of TABLES) {
      const rows = parsed.tables[t];
      if (!Array.isArray(rows)) {
        summary[t] = 0;
        continue;
      }
      await db.execAsync(`DELETE FROM ${t}`);
      let inserted = 0;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const cols = Object.keys(row as Record<string, unknown>);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map((c) => (row as Record<string, unknown>)[c]);
        try {
          await db.runAsync(
            `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
            values as SQLite.SQLiteBindParams,
          );
          inserted += 1;
        } catch {}
      }
      summary[t] = inserted;
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK').catch(() => {});
    throw e;
  }

  return {
    tables: summary,
    exportedAt: parsed.exportedAt ?? null,
  };
}
