import { describe, expect, it } from 'vitest';
import { Projects, type Store } from '../src/storage/projects';
import { changed, createDrawing } from '../src/drawing/model';
class MemoryStore implements Store {
  files = new Map<string, string>();
  failPath = '';
  async read(k: string) {
    return this.files.get(k) ?? null;
  }
  async write(k: string, v: string) {
    if (k === this.failPath) throw new Error('Disk full');
    this.files.set(k, v);
  }
  async remove(k: string) {
    this.files.delete(k);
  }
  async keys() {
    return [...this.files.keys()];
  }
}
describe('recoverable project storage', () => {
  it('serializes saves and refuses stale revisions', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent'),
      newer = changed({ ...d, name: 'Two' });
    await Promise.all([p.save(d), p.save(newer), p.save(d)]);
    expect((await p.load(d.id)).document.name).toBe('Two');
  });
  it('preserves the last successful save when primary promotion fails', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent');
    await p.save(d);
    store.failPath = d.id + '.json';
    await expect(p.save(changed({ ...d, name: 'Two' }))).rejects.toThrow('Disk full');
    expect((await p.load(d.id)).document.name).toBe('One');
  });
  it('recovers backup and permits saving when primary is malformed', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent');
    await p.save(d);
    await p.save(changed({ ...d, name: 'Two' }));
    store.files.set(d.id + '.json', '{broken');
    const recovered = await p.load(d.id);
    expect(recovered.recovered).toBe(true);
    expect(recovered.document.name).toBe('One');
    await p.save(changed(recovered.document));
    expect((await p.load(d.id)).recovered).toBe(false);
  });
  it('recovers a verified staged first save', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent');
    store.files.set(d.id + '.staged', JSON.stringify(d));
    expect((await p.load(d.id)).recovered).toBe(true);
    expect(await p.list()).toHaveLength(1);
  });
  it('does not downgrade a newer schema to an old backup', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent');
    await p.save(d);
    store.files.set(d.id + '.backup', JSON.stringify(d));
    store.files.set(d.id + '.json', JSON.stringify({ ...d, schemaVersion: 2 }));
    await expect(p.load(d.id)).rejects.toThrow('newer version');
    await expect(p.save(d)).rejects.toThrow('newer version');
    expect((await p.list())[0].error).toContain('newer version');
  });
  it('keeps corrupt projects visible and removes all versions on deletion', async () => {
    const store = new MemoryStore(),
      p = new Projects(store),
      d = createDrawing('One', 256, 256, 'transparent');
    await p.save(d);
    await p.save(changed(d));
    store.files.set(d.id + '.json', 'bad');
    store.files.set(d.id + '.backup', 'bad');
    expect((await p.list())[0].error).toBeTruthy();
    await p.delete(d.id);
    expect(await p.list()).toHaveLength(0);
  });
});
