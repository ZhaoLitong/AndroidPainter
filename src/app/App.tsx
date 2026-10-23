import { t, useLanguage, setLanguage, message, recentColorLabel } from '../i18n';
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
  const language = useLanguage();
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
  const [modal, setModal] = useState<
      'details' | 'colors' | 'menu' | 'help' | 'clear' | 'leave' | null
    >(null),
    [deleting, setDeleting] = useState<ProjectEntry | null>(null),
    [renaming, setRenaming] = useState<Drawing | null>(null);
  const [status, setStatus] = useState('Saved'),
    [notice, setNotice] = useState(''),
    [fitToken, setFitToken] = useState(0),
    [busy, setBusy] = useState(false);
  const dirtySince = useRef<number | null>(null),
    canvasHandle = useRef<CanvasHandle | null>(null),
    leaving = useRef(false),
    discarding = useRef(false),
    sizeNewCanvas = useRef(false),
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
    if (discarding.current) return false;
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
    if (docRef.current?.needsDetails) {
      setModal('details');
      return;
    }
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
  function startDrawing() {
    const names = new Set(entries.map((entry) => entry.document?.name));
    let name = t('Untitled drawing'),
      suffix = 2;
    while (names.has(name)) name = `${t('Untitled drawing')} ${suffix++}`;
    const draft = { ...createDrawing(name, 1080, 1440, '#ffffff'), needsDetails: true };
    open(draft);
    sizeNewCanvas.current = true;
    savedRevision.current = -1;
    setStatus('Draft');
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
            <button
              className="subtle"
              aria-label="Language / 语言"
              onClick={() => setLanguage(language === 'en' ? 'zh-CN' : 'en')}
            >
              {language === 'en' ? '中文' : 'English'}
            </button>
            <button className="subtle" onClick={() => setModal('help')}>
              {t('A little help')}{' '}
            </button>
          </header>
          <main className="gallery">
            <div className="gallery-title">
              <div>
                <p className="eyebrow">{t('YOUR LITTLE CREATIVE SPACE')}</p>
                <h1>
                  {t('Make something')} <br />
                  <em>{t('uniquely yours.')}</em>
                </h1>
                <p className="intro">
                  {t('A blank canvas. A few good tools. Endless possibilities.')}
                </p>
              </div>
              <button className="primary" onClick={startDrawing}>
                <Icon name="plus" />
                {t('New drawing')}{' '}
              </button>
            </div>
            <div className="section-label">
              <h2>
                {t('Your drawings')} <span>{entries.length}</span>
              </h2>
              <span>{t('Saved on this device')}</span>
            </div>
            {loading ? (
              <p role="status">{t('Opening your sketchbook…')}</p>
            ) : (
              <div className="project-grid">
                <button className="new-card" onClick={startDrawing}>
                  <span>
                    <Icon name="plus" size={30} />
                  </span>
                  <strong>{t('Start with a blank canvas')}</strong>
                  <small>{t('See where your imagination goes')}</small>
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
                      aria-label={t('Open ') + (entry.document?.name || t('unreadable project'))}
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
                      <strong>{entry.document?.name || t('Unreadable project')}</strong>
                      <small>
                        {(entry.error ? message(entry.error) : null) ||
                          new Date(entry.document!.updatedAt).toLocaleDateString(language, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                      </small>
                    </button>
                    <div className="project-actions">
                      {entry.document && (
                        <button onClick={() => setRenaming(entry.document!)}>{t('Rename')}</button>
                      )}
                      <button
                        aria-label={t('Delete ') + (entry.document?.name || t('project'))}
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
              {t('No accounts. No distractions. Just you and your ideas.')}{' '}
            </footer>
          </main>
        </>
      ) : (
        <div className="editor">
          <header className="editor-header">
            <button
              className="icon-button"
              aria-label={t('Back to drawings')}
              onClick={() => void leave()}
            >
              <Icon name="back" />
            </button>
            <button className="document-title" onClick={() => setRenaming(doc)}>
              <strong>{doc.name}</strong>
              <small role="status">{t(status)}</small>
            </button>
            {status === 'Save failed' && <button onClick={() => void save()}>{t('Retry')}</button>}
            <div className="history-buttons">
              <button
                className="icon-button"
                aria-label={t('Undo')}
                disabled={!doc.operations.length}
                onClick={undo}
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-button"
                aria-label={t('Redo')}
                disabled={!redo.length}
                onClick={redoOnce}
              >
                <Icon name="redo" />
              </button>
            </div>
            <button
              className="share-button"
              aria-label={busy ? t('Exporting PNG') : t('Share')}
              disabled={busy}
              onClick={() => void share()}
            >
              <Icon name="share" />
              <span>{busy ? 'Exporting…' : 'Share'}</span>
            </button>
            <button
              className="icon-button"
              aria-label={t('More options')}
              onClick={() => setModal('menu')}
            >
              <Icon name="more" />
            </button>
          </header>
          <DrawingCanvas
            onMeasure={(width, height) => {
              if (!sizeNewCanvas.current || !docRef.current) return;
              sizeNewCanvas.current = false;
              const ratio = Math.min(1, 2048 / Math.max(width, height));
              const next = {
                ...docRef.current,
                width: Math.max(1, Math.round(width * ratio)),
                height: Math.max(1, Math.round(height * ratio)),
              };
              docRef.current = next;
              setDoc(next);
            }}
            canvasHandle={canvasHandle}
            document={doc}
            tool={tool}
            style={activeStyle}
            fitToken={fitToken}
            onCommit={commit}
            onError={report}
          />
          <div className="tool-dock">
            <div className="tools" role="toolbar" aria-label={t('Drawing tools')}>
              {tools.map((toolName) => (
                <button
                  key={toolName}
                  title={t(toolName)}
                  aria-label={t(toolName[0].toUpperCase() + toolName.slice(1))}
                  aria-pressed={tool === toolName}
                  className={tool === toolName ? 'tool selected' : 'tool'}
                  onClick={() => setTool(toolName)}
                >
                  <Icon name={toolName} />
                  <span>{t(toolName)}</span>
                </button>
              ))}
            </div>
            <div className="tool-settings">
              <button
                className="current-color"
                aria-label={t('Choose colors')}
                onClick={() => setModal('colors')}
              >
                <span style={{ background: style.color, opacity: style.opacity }} />
                <span>{t('Color')}</span>
              </button>
              <label className="size-slider">
                <span>
                  {tool === 'eraser' ? t('Eraser') : t('Pen')} {t('size')}{' '}
                  <b>
                    {activeStyle.width} {t('px')}
                  </b>
                </span>
                <input
                  aria-label={t('Tool size')}
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
                    {t('Style')}{' '}
                    <select
                      aria-label={t('Shape style')}
                      value={style.mode}
                      onChange={(e) =>
                        setStyle({ ...style, mode: e.target.value as Style['mode'] })
                      }
                    >
                      <option value="outline">{t('Outline')}</option>
                      <option value="fill">{t('Fill')}</option>
                      <option value="both">{t('Both')}</option>
                    </select>
                  </label>
                  {tool !== 'triangle' && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={style.constrained}
                        onChange={(e) => setStyle({ ...style, constrained: e.target.checked })}
                      />
                      {tool === 'ellipse' ? t('Circle') : t('Square')}
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
          <span>{message(notice)}</span>
          <button
            className="icon-button"
            aria-label={t('Dismiss notification')}
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {modal === 'details' && doc && (
        <DrawingDetails
          document={doc}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (name) => {
            const current = docRef.current;
            if (!current) return;
            setBusy(true);
            update(changed({ ...current, name, needsDetails: false }));
            try {
              await leave();
            } finally {
              setBusy(false);
            }
          }}
          onDiscard={async () => {
            const current = docRef.current;
            if (!current) return;
            clearTimeout(saveTimer.current);
            discarding.current = true;
            setBusy(true);
            try {
              await projects.delete(current.id);
              docRef.current = null;
              setDoc(null);
              setRedo([]);
              setModal(null);
              await refresh();
            } catch (e) {
              report('Could not discard drawing: ' + (e as Error).message);
            } finally {
              discarding.current = false;
              setBusy(false);
            }
          }}
        />
      )}
      {modal === 'colors' && (
        <Modal title={t('Find your color')} onClose={() => setModal(null)}>
          <ColorControl
            label={t('Pen & outline')}
            value={style.color}
            onChange={(color) => setStyle({ ...style, color })}
          />
          <ColorControl
            label={t('Shape fill')}
            value={style.fill}
            onChange={(fill) => setStyle({ ...style, fill })}
          />
          <label className="field">
            {t('Opacity')} <span>{Math.round(style.opacity * 100)}%</span>
            <input
              aria-label={t('Opacity')}
              type="range"
              min="0"
              max="100"
              value={Math.round(style.opacity * 100)}
              onChange={(e) => setStyle({ ...style, opacity: +e.target.value / 100 })}
            />
          </label>
          <p className="eyebrow">{t('THE ESSENTIALS')}</p>
          <div className="swatches">
            {swatches.map((color) => (
              <button
                key={color}
                aria-label={t('Use ') + color}
                className={style.color === color ? 'active' : ''}
                style={{ background: color }}
                onClick={() => setStyle({ ...style, color })}
              />
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <p className="eyebrow">{t('RECENTLY USED')}</p>
              <div className="swatches">
                {recent.map((r, i) => (
                  <button
                    key={i}
                    aria-label={recentColorLabel(r.color, Math.round(r.opacity * 100))}
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
        <Modal title={t('Your canvas')} onClose={() => setModal(null)}>
          <div className="menu-list">
            <button
              aria-label="Language / 语言"
              onClick={() => setLanguage(language === 'en' ? 'zh-CN' : 'en')}
            >
              {language === 'en' ? '中文' : 'English'}
            </button>
            <button
              onClick={() => {
                setFitToken((v) => v + 1);
                setModal(null);
              }}
            >
              <Icon name="fit" />
              {t('Fit to screen')}{' '}
            </button>
            <button onClick={() => setModal('clear')}>
              <Icon name="trash" />
              {t('Clear canvas')}{' '}
            </button>
            <button onClick={() => setModal('help')}>
              <Icon name="palette" />
              {t('Drawing tips & storage')}{' '}
            </button>
            <button onClick={() => void leave()}>
              <Icon name="back" />
              {t('Back to drawings')}{' '}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title={t('A fresh start?')} onClose={() => setModal(null)}>
          <p>{t('This clears your drawing. You can undo it if you change your mind.')}</p>
          <div className="modal-actions">
            <button onClick={() => setModal(null)}>{t('Keep drawing')}</button>
            <button
              className="danger"
              onClick={() => {
                commit({ id: uid(), type: 'clear', points: [], style: { ...style } });
                setModal(null);
              }}
            >
              {t('Clear canvas')}{' '}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title={t('A little help')} onClose={() => setModal(null)}>
          <div className="help-copy">
            <p>
              <strong>{t('Make your mark.')}</strong>
              {t(
                'Tap for a dot, drag to draw. Choose a shape and drag from one corner to the other. Pick colors, opacity, and sizes in the toolbar.',
              )}{' '}
            </p>
            <p>
              <strong>{t('Get closer.')}</strong>
              {t(
                'Pinch with two fingers to zoom and pan. Adding a second finger cancels your unfinished stroke. Use Fit to screen to reset the view.',
              )}{' '}
            </p>
            <p>
              <strong>{t('Make changes.')}</strong>
              {t(
                'The eraser removes ink, including on transparent canvases. Undo restores strokes, shapes, erasing, and clears. Shapes cannot be moved after drawing.',
              )}{' '}
            </p>
            <p>
              <strong>{t('Your work stays here.')}</strong>
              {t(
                'Drawings save automatically on this device. Clearing app data or uninstalling removes them. Share a PNG to keep a picture elsewhere; PNGs cannot restore editable history.',
              )}{' '}
            </p>
            <p>
              <strong>{t('Keep it manageable.')}</strong>
              {t(
                'Canvas sizes go up to 2048 × 2048. Each project supports up to 5,000 actions, 250,000 points, and 20 MiB of editable data. Abruptly closing the app may lose changes since its last successful save.',
              )}{' '}
            </p>
          </div>
        </Modal>
      )}
      {modal === 'leave' && (
        <Modal title={t('Your changes are not saved')} onClose={() => setModal(null)}>
          <p>
            {t('Your last saved version is safe, but leaving now will discard unsaved changes.')}
          </p>
          <div className="modal-actions">
            <button onClick={() => void leave()}>{t('Retry save')}</button>
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
              {t('Leave without saving')}{' '}
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('Delete this drawing?')} onClose={() => setDeleting(null)}>
          <p>
            “{deleting.document?.name || t('Unreadable project')}
            {t('” will be permanently removed from this device. This cannot be undone.')}{' '}
          </p>
          <div className="modal-actions">
            <button onClick={() => setDeleting(null)}>{t('Keep it')}</button>
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
              {t('Delete drawing')}{' '}
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
    <Modal title={t('Name your drawing')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onRename(value.trim());
        }}
      >
        <label className="field">
          {t('Drawing name')}{' '}
          <input
            autoFocus
            maxLength={120}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="primary full" type="submit">
          {t('Save name')}{' '}
        </button>
      </form>
    </Modal>
  );
}
function DrawingDetails({
  document,
  busy,
  onClose,
  onSave,
  onDiscard,
}: {
  document: Drawing;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  onDiscard: () => void;
}) {
  const [name, setName] = useState(document.name);
  return (
    <Modal
      title={t('Save your drawing')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !busy) onSave(name.trim());
        }}
      >
        <label className="field">
          {t('Drawing name')}{' '}
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="hint">
          {document.width} × {document.height} · {t('White background')}
        </p>
        <button className="primary full" type="submit" disabled={busy || !name.trim()}>
          {busy ? t('Saving?') : t('Save drawing')}
        </button>
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {t('Keep drawing')}{' '}
          </button>
          <button type="button" className="danger" disabled={busy} onClick={onDiscard}>
            {t('Discard drawing')}{' '}
          </button>
        </div>
        <p className="hint">
          {t('Discard removes this draft and its automatic backup from this device.')}{' '}
        </p>
      </form>
    </Modal>
  );
}
