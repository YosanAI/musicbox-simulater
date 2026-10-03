/** Resolve the HTML contract once, rather than scattering unchecked selectors. */
export function collectElements(documentRoot = document) {
  const ids = [
    'sceneCanvas', 'sceneStage', 'toast', 'loading', 'library', 'libraryCount', 'nowTitle',
    'totalTime', 'currentTime', 'duration', 'pinCount', 'timeline', 'sourceBadge',
    'noteReadout', 'noteFrequency', 'ejectBtn', 'playBtn', 'playStatus', 'resetBtn',
    'windBtn', 'speed', 'speedOut', 'volume', 'resonance', 'resonanceOut', 'repeat',
    'highlights', 'showResonance', 'caseToggle', 'labelsBtn', 'labels', 'fullBtn', 'explodeBtn', 'uploadBtn',
    'fileInput', 'dropOverlay', 'guideBtn', 'guideDialog', 'copyPromptBtn', 'cylinderPrompt', 'promptCopyStatus', 'exportBtn', 'jsonBtn',
    'wavBtn', 'workshopBtn', 'workshopDialog', 'editTitle', 'editDuration',
    'editSteps', 'editTurn', 'editorScroll', 'editorCanvas', 'editPinCount', 'clearEditor',
    'applyEditor', 'rpm', 'turnOut', 'indexCue', 'indexMessage', 'reserveOut', 'reserveBar', 'settingsPanel',
  ];
  const elements = {};
  for (const id of ids) {
    const element = documentRoot.getElementById(id);
    if (!element) throw new Error(`Missing required interface element: #${id}`);
    elements[id] = element;
  }
  return elements;
}

/** One owner for a group of listeners; aborting also makes hot reload safe. */
export class EventScope {
  constructor() {
    this.controller = new AbortController();
  }

  on(target, type, listener, options = {}) {
    target.addEventListener(type, listener, {
      ...options,
      signal: this.controller.signal,
    });
  }

  dispose() {
    this.controller.abort();
  }
}
