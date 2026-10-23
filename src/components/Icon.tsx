const paths: Record<string, string> = {
  pen: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
  eraser: 'm15 4 6 6-10 10H5l-3-3L15 4ZM7 12l7 7M11 20h10',
  line: 'M5 19 19 5M4 18l2 2M18 4l2 2',
  rectangle: 'M4 5h16v14H4Z',
  ellipse: 'M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0',
  triangle: 'm12 3 10 18H2Z',
  undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',
  redo: 'm15 5 5 5-5 5M20 10H10a6 6 0 0 0 0 12',
  plus: 'M12 5v14M5 12h14',
  back: 'm14 5-7 7 7 7',
  share: 'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8',
  fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  more: 'M5 11v2m7-2v2m7-2v2',
  close: 'm6 6 12 12M6 18 18 6',
  palette:
    'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3-4-6-9-6ZM7 8h.01M12 6h.01M17 8h.01M5 13h.01',
};
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.pen} />
    </svg>
  );
}
