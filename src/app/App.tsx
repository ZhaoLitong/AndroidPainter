import { useCallback, useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { DrawingCanvas, type CanvasHandle } from '../drawing/Canvas';
import {
  changed,
  createDrawing,
  defaultStyle,
  uid,
  validate,
  type Drawing,
  type Operation,
  type Style,
  type Tool,
} from '../drawing/model';
import { thumbnail } from '../drawing/renderer';
import { projects, type ProjectEntry } from '../storage/projects';
import { cleanExports, shareDrawing } from '../platform/share';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ColorControl } from '../components/ColorControl';

const tools: Tool[] = ['pen', 'eraser', 'line', 'rectangle', 'ellipse', 'triangle'];
const swatches = [
  '#20252b',
  '#ffffff',
  '#ed6454',
  '#efa84d',
  '#efcf60',
  '#5b9876',
  '#619cbe',
  '#6977b5',
  '#ad7aa5',
  '#b58065',
];
type Recent = { color: string; opacity: number };
function preferences(): { style: Style; recent: Recent[] } {
  try {
    const p = JSON.parse(localStorage.getItem('painter-preferences') || 'null');
    if (p) {
      validate({
        ...createDrawing('preferences', 256, 256, '#ffffff'),
        operations: [{ id: 'test', type: 'pen', points: [{ x: 0, y: 0 }], style: p.style }],
      });
      return {
        style: p.style,
        recent: Array.isArray(p.recent)
          ? p.recent
              .filter(
                (r: Recent) => /^#[\da-f]{6}$/i.test(r.color) && r.opacity >= 0 && r.opacity <= 1,
              )
              .slice(0, 12)
          : [],
      };
    }
  } catch {
    /* Invalid preferences use defaults. */
  }
  return { style: defaultStyle, recent: [] };
}
export function App() {
  const [initial] = useState(preferences),
    [style, setStyle] = useState<Style>(initial.style),
    [recent, setRecent] = useState<Recent[]>(initial.recent),
    [tool, setTool] = useState<Tool>('pen'),
    [eraserWidth, setEraserWidth] = useState(32);
  const [doc, setDoc] = useState<Drawing | null>(null),
    docRef = useRef<Drawing | null>(null),
    [redo, setRedo] = useState<Operation[]>([]),
    [entries, setEntries] = useState<ProjectEntry[]>([]),
    [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'new' | 'colors' | 'menu' | 'help' | 'clear' | 'leave' | null>(
      null,
    ),
    [deleting, setDeleting] = useState<ProjectEntry | null>(null),
    [renaming, setRenaming] = useState<Drawing | null>(null);
  const [status, setStatus] = useState('Saved'),
    [notice, setNotice] = useState(''),
    [fitToken, setFitToken] = useState(0),
    [busy, setBusy] = useState(false);
  const dirtySince = useRef<number | null>(null),
    canvasHandle = useRef<CanvasHandle | null>(null),
    leaving = useRef(false),
    savedRevision = useRef(-1),
    saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    mounted = useRef(true);
  const report = useCallback((message: string) => setNotice(message), []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(
        (await projects.list()).sort((a, b) =>
          (b.document?.updatedAt || '').localeCompare(a.document?.updatedAt || ''),
        ),
      );
    } catch (e) {
      report('Could not read projects: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [report]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    void cleanExports();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    try {
      localStorage.setItem('painter-preferences', JSON.stringify({ style, recent }));
    } catch {
      /* Drawing storage remains independent of preferences. */
    }
  }, [style, recent]);
  const save = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const current = docRef.current;
    if (!current) return true;
    if (savedRevision.current === current.revision) return true;
    setStatus('Saving');
    try {
      await projects.save(current);
      if (docRef.current?.id === current.id && docRef.current.revision === current.revision) {
        savedRevision.current = current.revision;
        dirtySince.current = null;
        if (mounted.current) setStatus('Saved');
      }
      return true;
    } catch (e) {
      if (mounted.current && docRef.current?.id === current.id) {
        setStatus('Save failed');
        report('Your latest changes are still in memory. Retry saving: ' + (e as Error).message);
      }
      return false;
    }
  }, [report]);
  const update = useCallback(
    (next: Drawing) => {
      docRef.current = next;
      setDoc(next);
      setStatus('Saving');
      dirtySince.current ??= Date.now();
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => void save(),
        Math.max(0, Math.min(750, 5000 - (Date.now() - dirtySince.current))),
      );
    },
    [save],
  );
  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      while (docRef.current) {
        if (!(await save())) {
          setModal('leave');
          return;
        }
        const current = docRef.current;
        if (savedRevision.current !== current.revision) continue;
        try {
          await projects.saveThumbnail(
            current.id,
            thumbnail(current, canvasHandle.current?.snapshot()),
          );
        } catch {
          /* A failed thumbnail does not invalidate the saved document. */
        }
        // An edit may have arrived while the filesystem write was pending.
        if (docRef.current?.revision !== current.revision) continue;
        docRef.current = null;
      }
      clearTimeout(saveTimer.current);
      setDoc(null);
      setModal(null);
      setRedo([]);
      void refresh();
    } finally {
      leaving.current = false;
    }
  }, [save, refresh]);
  const backRef = useRef(() => {});
  backRef.current = () => {
    if (deleting) setDeleting(null);
    else if (renaming) setRenaming(null);
    else if (modal) setModal(null);
    else if (docRef.current) void leave();
    else if (Capacitor.isNativePlatform()) void NativeApp.exitApp();
  };
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) void save();
    };
    document.addEventListener('visibilitychange', visibility);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (docRef.current && savedRevision.current !== docRef.current.revision) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    const listeners = Capacitor.isNativePlatform()
      ? [
          NativeApp.addListener('backButton', () => backRef.current()),
          NativeApp.addListener('appStateChange', (state) => {
            if (!state.isActive) void save();
          }),
        ]
      : [];
    return () => {
      clearTimeout(saveTimer.current);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', beforeUnload);
      for (const listener of listeners) void listener.then((l) => l.remove());
    };
  }, [save]);
  function open(d: Drawing, recovered = false) {
    savedRevision.current = recovered ? -1 : d.revision;
    dirtySince.current = null;
    docRef.current = d;
    setDoc(d);
    setRedo([]);
    setModal(null);
    setStatus(recovered ? 'Save failed' : 'Saved');
    if (recovered)
      report(
        'Recovered the last readable version. Some recent changes may be missing. Save to keep this recovered drawing.',
      );
  }
  function commit(op: Operation) {
    const current = docRef.current;
    if (!current) return;
    try {
      const next = validate(changed(current, [...current.operations, op]));
      setRedo([]);
      update(next);
      if (op.type !== 'eraser' && op.type !== 'clear')
        setRecent((prev) =>
          [
            { color: op.style.color, opacity: op.style.opacity },
            ...prev.filter((r) => r.color !== op.style.color || r.opacity !== op.style.opacity),
          ].slice(0, 12),
        );
    } catch (e) {
      report((e as Error).message);
    }
  }
  function undo() {
    const current = docRef.current;
    if (!current?.operations.length) return;
    setRedo((prev) => [current.operations[current.operations.length - 1], ...prev]);
    update(changed(current, current.operations.slice(0, -1)));
  }
  function redoOnce() {
    const current = docRef.current;
    if (!current || !redo.length) return;
    update(changed(current, [...current.operations, redo[0]]));
    setRedo(redo.slice(1));
  }
  async function share() {
    if (!docRef.current) return;
    setBusy(true);
    try {
      await shareDrawing(docRef.current, canvasHandle.current?.snapshot());
    } catch (e) {
      report('Could not export: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const activeStyle = { ...style, width: tool === 'eraser' ? eraserWidth : style.width };
  const shape = ['rectangle', 'ellipse', 'triangle'].includes(tool);
  return (
    <div className="app">
      {!doc ? (
        <>
          <header className="gallery-header">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="brand-icon">
                <Icon name="pen" />
              </span>
              painter<span className="brand-dot">.</span>
            </a>
            <button className="subtle" onClick={() => setModal('help')}>
              A little help
            </button>
          </header>
          <main className="gallery">
            <div className="gallery-title">
              <div>
                <p className="eyebrow">YOUR LITTLE CREATIVE SPACE</p>
                <h1>
                  Make something
                  <br />
                  <em>uniquely yours.</em>
                </h1>
                <p className="intro">A blank canvas. A few good tools. Endless possibilities.</p>
              </div>
              <button className="primary" onClick={() => setModal('new')}>
                <Icon name="plus" />
                New drawing
              </button>
            </div>
            <div className="section-label">
              <h2>
                Your drawings <span>{entries.length}</span>
              </h2>
              <span>Saved on this device</span>
            </div>
            {loading ? (
              <p role="status">Opening your sketchbook…</p>
            ) : (
              <div className="project-grid">
                <button className="new-card" onClick={() => setModal('new')}>
                  <span>
                    <Icon name="plus" size={30} />
                  </span>
                  <strong>Start with a blank canvas</strong>
                  <small>See where your imagination goes</small>
                </button>
                {entries.map((entry) => (
                  <article className="project-card" key={entry.id}>
                    <button
                      className="project-open"
                      onClick={async () => {
                        try {
                          const result = await projects.load(entry.id);
                          open(result.document, result.recovered);
                        } catch (e) {
                          report((e as Error).message);
                        }
                      }}
                      aria-label={'Open ' + (entry.document?.name || 'unreadable project')}
                    >
                      <div className="project-preview checker">
                        {entry.thumbnail ? (
                          <img src={entry.thumbnail} alt="" />
                        ) : (
                          <span>
                            <Icon name={entry.error ? 'close' : 'pen'} size={32} />
                          </span>
                        )}
                      </div>
                      <strong>{entry.document?.name || 'Unreadable project'}</strong>
                      <small>
                        {entry.error ||
                          new Date(entry.document!.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                      </small>
                    </button>
                    <div className="project-actions">
                      {entry.document && (
                        <button onClick={() => setRenaming(entry.document!)}>Rename</button>
                      )}
                      <button
                        aria-label={'Delete ' + (entry.document?.name || 'project')}
                        onClick={() => setDeleting(entry)}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <footer className="gallery-footer">
              <span className="tiny-dot" />
              No accounts. No distractions. Just you and your ideas.
            </footer>
          </main>
        </>
      ) : (
        <div className="editor">
          <header className="editor-header">
            <button
              className="icon-button"
              aria-label="Back to drawings"
              onClick={() => void leave()}
            >
              <Icon name="back" />
            </button>
            <button className="document-title" onClick={() => setRenaming(doc)}>
              <strong>{doc.name}</strong>
              <small role="status">{status}</small>
            </button>
            {status === 'Save failed' && <button onClick={() => void save()}>Retry</button>}
            <div className="history-buttons">
              <button
                className="icon-button"
                aria-label="Undo"
                disabled={!doc.operations.length}
                onClick={undo}
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                disabled={!redo.length}
                onClick={redoOnce}
              >
                <Icon name="redo" />
              </button>
            </div>
            <button
              className="share-button"
              aria-label={busy ? 'Exporting PNG' : 'Share'}
              disabled={busy}
              onClick={() => void share()}
            >
              <Icon name="share" />
              <span>{busy ? 'Exporting…' : 'Share'}</span>
            </button>
            <button
              className="icon-button"
              aria-label="More options"
              onClick={() => setModal('menu')}
            >
              <Icon name="more" />
            </button>
          </header>
          <DrawingCanvas
            canvasHandle={canvasHandle}
            document={doc}
            tool={tool}
            style={activeStyle}
            fitToken={fitToken}
            onCommit={commit}
            onError={report}
          />
          <div className="tool-dock">
            <div className="tools" role="toolbar" aria-label="Drawing tools">
              {tools.map((t) => (
                <button
                  key={t}
                  title={t}
                  aria-label={t[0].toUpperCase() + t.slice(1)}
                  aria-pressed={tool === t}
                  className={tool === t ? 'tool selected' : 'tool'}
                  onClick={() => setTool(t)}
                >
                  <Icon name={t} />
                  <span>{t}</span>
                </button>
              ))}
            </div>
            <div className="tool-settings">
              <button
                className="current-color"
                aria-label="Choose colors"
                onClick={() => setModal('colors')}
              >
                <span style={{ background: style.color, opacity: style.opacity }} />
                <span>Color</span>
              </button>
              <label className="size-slider">
                <span>
                  {tool === 'eraser' ? 'Eraser' : 'Pen'} size <b>{activeStyle.width} px</b>
                </span>
                <input
                  aria-label="Tool size"
                  type="range"
                  min="1"
                  max={tool === 'eraser' ? 256 : 128}
                  value={activeStyle.width}
                  onChange={(e) =>
                    tool === 'eraser'
                      ? setEraserWidth(+e.target.value)
                      : setStyle({ ...style, width: +e.target.value })
                  }
                />
              </label>
              {shape && (
                <>
                  <label className="shape-mode">
                    Style
                    <select
                      aria-label="Shape style"
                      value={style.mode}
                      onChange={(e) =>
                        setStyle({ ...style, mode: e.target.value as Style['mode'] })
                      }
                    >
                      <option value="outline">Outline</option>
                      <option value="fill">Fill</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                  {tool !== 'triangle' && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={style.constrained}
                        onChange={(e) => setStyle({ ...style, constrained: e.target.checked })}
                      />
                      {tool === 'ellipse' ? 'Circle' : 'Square'}
                    </label>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {modal === 'new' && (
        <NewProject
          count={entries.length}
          onClose={() => setModal(null)}
          onCreate={async (d) => {
            setBusy(true);
            try {
              await projects.save(d);
              open(d);
            } catch (e) {
              report('Could not create drawing: ' + (e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
      {modal === 'colors' && (
        <Modal title="Find your color" onClose={() => setModal(null)}>
          <ColorControl
            label="Pen & outline"
            value={style.color}
            onChange={(color) => setStyle({ ...style, color })}
          />
          <ColorControl
            label="Shape fill"
            value={style.fill}
            onChange={(fill) => setStyle({ ...style, fill })}
          />
          <label className="field">
            Opacity <span>{Math.round(style.opacity * 100)}%</span>
            <input
              aria-label="Opacity"
              type="range"
              min="0"
              max="100"
              value={Math.round(style.opacity * 100)}
              onChange={(e) => setStyle({ ...style, opacity: +e.target.value / 100 })}
            />
          </label>
          <p className="eyebrow">THE ESSENTIALS</p>
          <div className="swatches">
            {swatches.map((color) => (
              <button
                key={color}
                aria-label={'Use ' + color}
                className={style.color === color ? 'active' : ''}
                style={{ background: color }}
                onClick={() => setStyle({ ...style, color })}
              />
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <p className="eyebrow">RECENTLY USED</p>
              <div className="swatches">
                {recent.map((r, i) => (
                  <button
                    key={i}
                    aria-label={`Use ${r.color} at ${Math.round(r.opacity * 100)} percent`}
                    style={{ background: r.color, opacity: r.opacity }}
                    onClick={() => setStyle({ ...style, ...r })}
                  />
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === 'menu' && (
        <Modal title="Your canvas" onClose={() => setModal(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                setFitToken((v) => v + 1);
                setModal(null);
              }}
            >
              <Icon name="fit" />
              Fit to screen
            </button>
            <button onClick={() => setModal('clear')}>
              <Icon name="trash" />
              Clear canvas
            </button>
            <button onClick={() => setModal('help')}>
              <Icon name="palette" />
              Drawing tips & storage
            </button>
            <button onClick={() => void leave()}>
              <Icon name="back" />
              Back to drawings
            </button>
          </div>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title="A fresh start?" onClose={() => setModal(null)}>
          <p>This clears your drawing. You can undo it if you change your mind.</p>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>Keep drawing</button>
            <button
              className="danger"
              onClick={() => {
                commit({ id: uid(), type: 'clear', points: [], style: { ...style } });
                setModal(null);
              }}
            >
              Clear canvas
            </button>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="A little help" onClose={() => setModal(null)}>
          <div className="help-copy">
            <p>
              <strong>Make your mark.</strong> Tap for a dot, drag to draw. Choose a shape and drag
              from one corner to the other. Pick colors, opacity, and sizes in the toolbar.
            </p>
            <p>
              <strong>Get closer.</strong> Pinch with two fingers to zoom and pan. Adding a second
              finger cancels your unfinished stroke. Use Fit to screen to reset the view.
            </p>
            <p>
              <strong>Make changes.</strong> The eraser removes ink, including on transparent
              canvases. Undo restores strokes, shapes, erasing, and clears. Shapes cannot be moved
              after drawing.
            </p>
            <p>
              <strong>Your work stays here.</strong> Drawings save automatically on this device.
              Clearing app data or uninstalling removes them. Share a PNG to keep a picture
              elsewhere; PNGs cannot restore editable history.
            </p>
            <p>
              <strong>Keep it manageable.</strong> Canvas sizes go up to 2048 × 2048. Each project
              supports up to 5,000 actions, 250,000 points, and 20 MiB of editable data. Abruptly
              closing the app may lose changes since its last successful save.
            </p>
          </div>
        </Modal>
      )}
      {modal === 'leave' && (
        <Modal title="Your changes are not saved" onClose={() => setModal(null)}>
          <p>Your last saved version is safe, but leaving now will discard unsaved changes.</p>
          <div className="modal-actions">
            <button onClick={() => void leave()}>Retry save</button>
            <button
              className="danger"
              onClick={() => {
                clearTimeout(saveTimer.current);
                docRef.current = null;
                setDoc(null);
                setModal(null);
                void refresh();
              }}
            >
              Leave without saving
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this drawing?" onClose={() => setDeleting(null)}>
          <p>
            “{deleting.document?.name || 'Unreadable project'}” will be permanently removed from
            this device. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button onClick={() => setDeleting(null)}>Keep it</button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await projects.delete(deleting.id);
                  setDeleting(null);
                  await refresh();
                } catch (e) {
                  report((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete drawing
            </button>
          </div>
        </Modal>
      )}
      {renaming && (
        <Rename
          name={renaming.name}
          onClose={() => setRenaming(null)}
          onRename={async (name) => {
            const next = changed({ ...renaming, name });
            if (docRef.current?.id === next.id) {
              update(changed({ ...docRef.current, name }));
              setRenaming(null);
            } else {
              try {
                await projects.save(next);
                setRenaming(null);
                await refresh();
              } catch (e) {
                report((e as Error).message);
              }
            }
          }}
        />
      )}
    </div>
  );
}
function Rename({
  name,
  onClose,
  onRename,
}: {
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <Modal title="Name your drawing" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onRename(value.trim());
        }}
      >
        <label className="field">
          Drawing name
          <input
            autoFocus
            maxLength={120}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="primary full" type="submit">
          Save name
        </button>
      </form>
    </Modal>
  );
}
function NewProject({
  count,
  onClose,
  onCreate,
  busy,
}: {
  count: number;
  onClose: () => void;
  onCreate: (d: Drawing) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(count ? `Untitled drawing ${count + 1}` : 'Untitled drawing'),
    [preset, setPreset] = useState('portrait'),
    [width, setWidth] = useState(1080),
    [height, setHeight] = useState(1440),
    [background, setBackground] = useState('#ffffff'),
    [transparent, setTransparent] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Something starts here" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onCreate(createDrawing(name, width, height, transparent ? 'transparent' : background));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="field">
          Drawing name
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Canvas size
          <select
            value={preset}
            onChange={(e) => {
              const p = e.target.value;
              setPreset(p);
              if (p === 'portrait') {
                setWidth(1080);
                setHeight(1440);
              }
              if (p === 'square') {
                setWidth(1024);
                setHeight(1024);
              }
              if (p === 'landscape') {
                setWidth(1440);
                setHeight(1080);
              }
            }}
          >
            <option value="portrait">Portrait · 1080 × 1440</option>
            <option value="square">Square · 1024 × 1024</option>
            <option value="landscape">Landscape · 1440 × 1080</option>
            <option value="custom">Custom dimensions</option>
          </select>
        </label>
        {preset === 'custom' && (
          <div className="dimensions">
            <label className="field">
              Width
              <input
                type="number"
                min="256"
                max="2048"
                required
                value={width}
                onChange={(e) => setWidth(+e.target.value)}
              />
            </label>
            <label className="field">
              Height
              <input
                type="number"
                min="256"
                max="2048"
                required
                value={height}
                onChange={(e) => setHeight(+e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => setTransparent(e.target.checked)}
          />
          Transparent background
        </label>
        {!transparent && (
          <ColorControl label="Background" value={background} onChange={setBackground} />
        )}
        <p className="hint">Canvas dimensions and background stay fixed once you start.</p>
        {error && <p role="alert">{error}</p>}
        <button className="primary full" type="submit" disabled={busy}>
          <Icon name="plus" />
          {busy ? 'Creating…' : 'Create drawing'}
        </button>
      </form>
    </Modal>
  );
}
