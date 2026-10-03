import './styles/main.css';
import { MusicBoxApp } from './app/MusicBoxApp.js';
import { MusicBoxScene } from './scene/MusicBoxScene.js';

let app;
try {
  app = new MusicBoxApp({
    createScene: (canvas, onTooth, onWind) => new MusicBoxScene(canvas, onTooth, onWind),
  });
  app.start();
} catch (error) {
  console.error(error);
  app?.dispose();
  const loading = document.getElementById('loading');
  loading.classList.remove('done');
  loading.style.padding = '30px';
  loading.textContent = `Could not start: ${error.message}`;
}

// Each app owns and releases its RAF, listeners, GPU resources and AudioContext.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => app?.dispose());
}
