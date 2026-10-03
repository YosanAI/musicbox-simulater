import './styles/main.css';
import { MusicBoxApp } from './app/MusicBoxApp.js';
import { MusicBoxScene } from './scene/MusicBoxScene.js';
import { loadSampleLibrary } from './io/sampleLibrary.js';

let app;
const startup = new AbortController();

// Abort pending sample requests as well as disposing a running app on hot reload.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    startup.abort();
    app?.dispose();
  });
}

try {
  const baseUrl = import.meta.env.BASE_URL;
  const response = await fetch(`${baseUrl}sample-library.json`, { signal: startup.signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the cylinder library (${response.status}).`);
  const { entries, errors } = await loadSampleLibrary(await response.json(), `${baseUrl}samples/`, {
    signal: startup.signal,
  });
  startup.signal.throwIfAborted();
  if (!entries.length) throw new Error('No playable cylinders found in the samples folder.');
  app = new MusicBoxApp({
    createScene: (canvas, onTooth, onWind) => new MusicBoxScene(canvas, onTooth, onWind),
    library: entries,
  });
  app.start();
  if (errors.length) {
    console.warn('Some sample files could not be loaded:', errors);
    app.notifications.show(`Could not load: ${errors.map(error => error.filename).join(', ')}. Other cylinders are ready to play.`, true, 12000);
  }
} catch (error) {
  if (!startup.signal.aborted) {
    console.error(error);
    app?.dispose();
    const loading = document.getElementById('loading');
    loading.classList.remove('done');
    loading.style.padding = '30px';
    loading.textContent = `Could not start: ${error.message}`;
  }
}
