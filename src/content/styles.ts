export const styles = String.raw`
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    color-scheme: light;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, textarea, select { font: inherit; }
  .fp-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: min(370px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
    color: #1c211d;
    background: #f4f1e8;
    border: 1px solid #1c211d;
    border-radius: 10px;
    box-shadow: 5px 6px 0 rgba(28, 33, 29, 0.28);
    font: 13px/1.4 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  }
  .fp-panel.collapsed { width: 218px; }
  .fp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 9px 8px 12px;
    color: #f8f5ec;
    background: #1c211d;
  }
  .fp-title { flex: 1; font-weight: 750; letter-spacing: -0.02em; }
  .fp-count { color: #c7f36b; font-variant-numeric: tabular-nums; }
  .fp-head button {
    width: 28px;
    height: 28px;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 1px solid #697169;
    border-radius: 5px;
    cursor: pointer;
  }
  .fp-head button:hover, .fp-head button:focus-visible { border-color: #c7f36b; outline: none; }
  .fp-body { min-height: 0; overflow: auto; padding: 12px; }
  .fp-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .fp-actions .wide { grid-column: 1 / -1; }
  button.fp-button, .fp-row button {
    min-height: 34px;
    padding: 7px 9px;
    color: #1c211d;
    background: #fffdf7;
    border: 1px solid #92978f;
    border-radius: 6px;
    cursor: pointer;
  }
  button.fp-button:hover, button.fp-button:focus-visible, .fp-row button:hover, .fp-row button:focus-visible {
    border-color: #1c211d;
    box-shadow: 2px 2px 0 #c7f36b;
    outline: none;
  }
  button.primary { color: #fff; background: #285c49; border-color: #285c49; }
  button.danger { color: #8f2617; }
  button:disabled { opacity: .45; cursor: default; box-shadow: none !important; }
  .fp-section { margin-top: 13px; padding-top: 12px; border-top: 1px solid #c7c5bc; }
  .fp-label { display: block; margin-bottom: 6px; color: #596058; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .fp-empty { margin: 8px 0 2px; color: #6b706a; }
  .fp-list { display: grid; gap: 7px; }
  .fp-row {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: start;
    gap: 7px;
    padding: 8px;
    background: #fffdf7;
    border: 1px solid #c7c5bc;
    border-radius: 7px;
  }
  .fp-number {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    color: white;
    background: #285c49;
    border-radius: 50%;
    font-weight: 800;
  }
  .fp-comment { min-width: 0; padding: 0; text-align: left; color: inherit; background: transparent; border: 0; cursor: pointer; }
  .fp-comment:focus-visible { outline: 2px solid #285c49; outline-offset: 3px; }
  .fp-comment-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-sans-serif, system-ui, sans-serif; }
  .fp-meta { margin-top: 2px; color: #6b706a; font-size: 11px; }
  .fp-unresolved { color: #9a311f; font-weight: 700; }
  .fp-row-menu { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 4px; }
  .fp-row button { min-height: 26px; padding: 3px 6px; font-size: 11px; }
  .fp-editor { padding: 10px; background: #fffdf7; border: 1px solid #285c49; border-radius: 7px; }
  .fp-editor textarea {
    width: 100%;
    min-height: 88px;
    resize: vertical;
    padding: 8px;
    color: #1c211d;
    background: white;
    border: 1px solid #92978f;
    border-radius: 5px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .fp-editor textarea:focus { border-color: #285c49; outline: 2px solid rgba(40, 92, 73, .18); }
  .fp-check { display: flex; align-items: center; gap: 7px; margin: 8px 0; }
  .fp-editor-actions { display: flex; justify-content: flex-end; gap: 7px; }
  .fp-selecting {
    margin-top: 10px;
    padding: 9px;
    color: #13231c;
    background: #dff3b7;
    border: 1px solid #86a34c;
    border-radius: 6px;
  }
  .fp-select-controls { display: flex; gap: 6px; margin-top: 7px; }
  .fp-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .fp-footer select { min-height: 34px; padding: 5px; background: #fffdf7; border: 1px solid #92978f; border-radius: 6px; }
  .fp-retention { display: flex; align-items: center; justify-content: space-between; gap: 8px; grid-column: 1 / -1; color: #596058; }
  .fp-retention select { min-height: 30px; }
  .fp-status { margin: 9px 0 0; padding: 7px 8px; background: #e8e5dc; border-radius: 5px; }
  .fp-status.error { color: #8f2617; background: #f5d7d0; }
  .fp-warning { margin-bottom: 10px; padding: 8px; color: #71301f; background: #f6ddbf; border: 1px solid #d29b6b; border-radius: 6px; }
  .fp-target, .fp-preview {
    position: fixed;
    pointer-events: none;
    border: 2px solid #ff4d24;
    background: rgba(255, 77, 36, .09);
    border-radius: 3px;
  }
  .fp-target .badge {
    position: absolute;
    top: -12px;
    left: -12px;
    display: grid;
    place-items: center;
    min-width: 23px;
    height: 23px;
    padding: 0 5px;
    color: white;
    background: #ff4d24;
    border: 2px solid white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
    font: 800 11px/1 ui-monospace, monospace;
  }
  .fp-preview { border-color: #35a7ff; background: rgba(53, 167, 255, .12); }
  .fp-target.flash { animation: fp-flash .28s ease-in-out 5 alternate; }
  @keyframes fp-flash { to { border-color: #c7f36b; background: rgba(199, 243, 107, .32); } }
  @media (prefers-reduced-motion: reduce) { .fp-target.flash { animation: none; } }
`;
