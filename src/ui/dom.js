/** Resolve the HTML contract once, rather than scattering unchecked selectors. */
export function collectElements(documentRoot = document) {
  const ids = [
    'sceneCanvas', 'toast', 'loading', 'library', 'libraryCount', 'nowTitle',
    'totalTime', 'currentTime', 'duration', 'pinCount', 'timeline', 'sourceBadge',
    'noteReadout', 'noteFrequency', 'ejectBtn', 'playBtn', 'playStatus', 'resetBtn',
    'windBtn', 'speed', 'speedOut', 'volume', 'resonance', 'resonanceOut', 'repeat',
    'highlights', 'caseToggle', 'labelsBtn', 'labels', 'fullBtn', 'uploadBtn',
    'fileInput', 'dropOverlay', 'guideBtn', 'guideDialog', 'exportBtn', 'jsonBtn',
    'wavBtn', 'workshopBtn', 'workshopDialog', 'editTitle', 'editDuration',
    'editSteps', 'editorScroll', 'editorCanvas', 'editPinCount', 'clearEditor',
    'applyEditor', 'rpm', 'reserveOut', 'reserveBar', 'settingsPanel',
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
