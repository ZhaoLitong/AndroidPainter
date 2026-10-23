import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { validate, type Drawing } from '../drawing/model';

export interface Store {
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
const nativeStore: Store = {
  async read(path) {
    try {
      const r = await Filesystem.readFile({
        path: 'projects/' + path,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return String(r.data);
    } catch (e) {
      if (/not exist|not found|ENOENT/i.test(String((e as Error).message))) return null;
      throw e;
    }
  },
  async write(path, data) {
    await Filesystem.writeFile({
      path: 'projects/' + path,
      data,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
  async remove(path) {
    try {
      await Filesystem.deleteFile({ path: 'projects/' + path, directory: Directory.Data });
    } catch (e) {
      if (!/not exist|not found|ENOENT/i.test(String((e as Error).message))) throw e;
    }
  },
  async keys() {
    try {
      return (await Filesystem.readdir({ path: 'projects', directory: Directory.Data })).files.map(
        (f) => f.name,
      );
    } catch (e) {
      if (/not exist|not found|ENOENT/i.test(String((e as Error).message))) return [];
      throw e;
    }
  },
};
// IndexedDB has substantially more capacity than localStorage and survives browser reloads.
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('painter', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('files', mode),
      request = fn(tx.objectStore('files'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage operation interrupted.'));
  });
}
const browserStore: Store = {
  async read(key) {
    return (await transaction('readonly', (s) => s.get(key))) ?? null;
  },
  async write(key, data) {
    await transaction('readwrite', (s) => s.put(data, key));
  },
  async remove(key) {
    await transaction('readwrite', (s) => s.delete(key));
  },
  async keys() {
    return (await transaction('readonly', (s) => s.getAllKeys())).map(String);
  },
};
export type ProjectEntry = {
  id: string;
  document?: Drawing;
  thumbnail?: string;
  error?: string;
  recovered?: boolean;
};
export class Projects {
  private queue = Promise.resolve();
  constructor(private store: Store) {}
  async load(id: string): Promise<{ document: Drawing; recovered: boolean }> {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid project identifier.');
    let error: unknown;
    const primary = await this.store.read(id + '.json');
    if (primary) {
      try {
        const raw = JSON.parse(primary);
        if (raw.schemaVersion > 1 || raw.rendererVersion > 1)
          throw new Error('This project requires a newer version of Painter.');
        return { document: this.checked(primary, id), recovered: false };
      } catch (e) {
        error = e;
        if (String(e).includes('newer version')) throw e;
      }
    }
    for (const suffix of ['.staged', '.backup']) {
      const data = await this.store.read(id + suffix);
      if (data)
        try {
          return { document: this.checked(data, id), recovered: true };
        } catch (e) {
          error = e;
        }
    }
    throw error || new Error('Project file is missing.');
  }
  private checked(data: string, id: string) {
    const d = validate(JSON.parse(data));
    if (d.id !== id) throw new Error('Project identifier does not match its file.');
    return d;
  }
  save(document: Drawing) {
    const snapshot = JSON.stringify(validate(document));
    const job = this.queue.then(async () => {
      const id = document.id,
        current = await this.store.read(id + '.json');
      if (current) {
        let raw;
        try {
          raw = JSON.parse(current);
        } catch {
          raw = null;
        }
        if (raw && (raw.schemaVersion > 1 || raw.rendererVersion > 1))
          throw new Error('This project requires a newer version of Painter.');
        let previous: Drawing | undefined;
        try {
          previous = this.checked(current, id);
        } catch {
          /* Preserve any known-good backup if the primary is corrupt. */
        }
        if (previous) {
          if (previous.revision > document.revision) return;
          await this.store.write(id + '.backup', current);
        }
      }
      await this.store.write(id + '.staged', snapshot);
      const staged = await this.store.read(id + '.staged');
      if (staged !== snapshot) throw new Error('Could not verify saved project. Please retry.');
      this.checked(staged, id);
      await this.store.write(id + '.json', staged);
      if ((await this.store.read(id + '.json')) !== snapshot)
        throw new Error('Could not verify saved project. Please retry.');
      await this.store.remove(id + '.staged');
    });
    this.queue = job.catch(() => {});
    return job;
  }
  async list(): Promise<ProjectEntry[]> {
    await this.queue;
    const keys = await this.store.keys(),
      ids = [
        ...new Set(
          keys
            .filter((k) => /\.(json|backup|staged)$/.test(k))
            .map((k) => k.replace(/\.[^.]+$/, '')),
        ),
      ];
    return Promise.all(
      ids.map(async (id) => {
        try {
          const result = await this.load(id);
          let thumbnail: string | undefined;
          try {
            thumbnail = (await this.store.read(id + '.thumb')) ?? undefined;
          } catch {
            /* A thumbnail is optional. */
          }
          return { id, ...result, thumbnail };
        } catch (e) {
          return { id, error: (e as Error).message };
        }
      }),
    );
  }
  async saveThumbnail(id: string, data: string) {
    await this.store.write(id + '.thumb', data);
  }
  async delete(id: string) {
    await this.queue;
    for (const suffix of ['.json', '.backup', '.staged', '.thumb'])
      await this.store.remove(id + suffix);
  }
}
export const projects = new Projects(Capacitor.isNativePlatform() ? nativeStore : browserStore);
