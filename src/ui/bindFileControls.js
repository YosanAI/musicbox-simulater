import { exportCylinderGLB } from '../cylinder/gltf/exportGLB.js';
import { safeFilename } from '../io/download.js';
import { serializeCylinder } from '../io/cylinderFiles.js';

export function bindFileControls(app) {
  const { elements, events, notifications, transport, sound, downloads } = app;
  const on = (element, type, action) => events.on(element, type, notifications.guard(action));
  on(elements.uploadBtn, 'click', () => elements.fileInput.click());
  on(elements.fileInput, 'change', async event => {
    try {
      await app.importFile(event.target.files[0]);
    } finally {
      event.target.value = '';
    }
  });

  let dragDepth = 0;
  const hasFiles = event => [...event.dataTransfer?.types || []].includes('Files');
  on(document, 'dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    elements.dropOverlay.classList.add('show');
  });
  on(document, 'dragover', event => {
    if (hasFiles(event)) event.preventDefault();
  });
  on(document, 'dragleave', () => {
    dragDepth--;
    if (dragDepth <= 0) elements.dropOverlay.classList.remove('show');
  });
  on(document, 'drop', async event => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropOverlay.classList.remove('show');
    if (event.dataTransfer.files.length) await app.importFile(event.dataTransfer.files[0]);
  });

  on(elements.exportBtn, 'click', () => {
    const spec = transport.spec;
    downloads.save(exportCylinderGLB(spec), `${safeFilename(spec.title)}.glb`, 'model/gltf-binary');
    notifications.show('Exported a canonical 3D cylinder with individually editable pins.');
  });
  on(elements.jsonBtn, 'click', () => {
    const spec = transport.spec;
    downloads.save(serializeCylinder(spec), `${safeFilename(spec.title)}.json`, 'application/json');
  });
  on(elements.wavBtn, 'click', async () => {
    elements.wavBtn.disabled = true;
    app.pause();
    notifications.show('Rendering a dry, synthesized stereo WAV…', false, 20000);
    try {
      const spec = transport.spec;
      const bytes = await sound.renderWav(spec, transport.speed);
      downloads.save(bytes, `${safeFilename(spec.title)}.wav`, 'audio/wav');
      notifications.show('WAV ready. The export is dry; the live room-resonance effect is not included.');
    } finally {
      elements.wavBtn.disabled = false;
    }
  });
}
