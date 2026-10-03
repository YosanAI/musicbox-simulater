import { clamp } from '../math/scalars.js';
import { getCylinderDuration } from '../cylinder/index.js';

/** Inputs only call the application/transport; they do not own playback state. */
export function bindPlayerControls(app) {
  const { elements, events, notifications, transport, sound, scene } = app;
  const guard = action => notifications.guard(action);
  const on = (element, type, action) => events.on(element, type, guard(action));

  on(elements.playBtn, 'click', () => app.togglePlay());
  on(elements.resetBtn, 'click', () => app.reset());
  on(elements.windBtn, 'click', () => app.wind());
  on(elements.speed, 'input', async event => {
    const speed = Number(event.target.value);
    elements.speedOut.textContent = `${speed.toFixed(2)}×`;
    app.state.resonances = [];
    await transport.setSpeed(speed);
    app.playerView.sync();
  });
  on(elements.duration, 'change', event => app.changeDuration(Number(event.target.value)));
  on(elements.volume, 'input', event => sound.setVolume(Number(event.target.value)));
  on(elements.resonance, 'input', event => {
    const resonance = Number(event.target.value);
    sound.setResonance(resonance);
    elements.resonanceOut.textContent = `${Math.round(resonance * 100)}%`;
  });
  on(elements.repeat, 'change', async event => {
    const wasPlaying = transport.running;
    app.pause();
    transport.loop = event.target.checked;
    if (wasPlaying) await transport.play();
    app.playerView.sync();
  });
  on(elements.highlights, 'change', event => { scene.highlights = event.target.checked; });
  on(elements.showResonance, 'change', event => { app.state.showResonance = event.target.checked; });
  on(elements.caseToggle, 'change', event => scene.setCase(event.target.checked));
  on(elements.ejectBtn, 'click', () => {
    app.pause();
    const lifted = scene.eject();
    elements.ejectBtn.querySelector('span').textContent = lifted ? 'Mount' : 'Lift';
    notifications.show(lifted
      ? 'Cylinder lifted. Mount it again to engage the comb.'
      : 'Cylinder mounted.');
    app.playerView.sync();
  });

  let scrubbing = false;
  let resumeAfterScrub = false;
  const seek = async event => {
    const bounds = elements.timeline.getBoundingClientRect();
    const fraction = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    app.state.resonances = [];
    await transport.seek(fraction * getCylinderDuration(transport.spec));
    scene.renderer.shadowDirty = true;
    app.playerView.sync();
  };
  on(elements.timeline, 'pointerdown', async event => {
    scrubbing = true;
    resumeAfterScrub = transport.running;
    app.pause();
    elements.timeline.setPointerCapture(event.pointerId);
    await seek(event);
  });
  on(elements.timeline, 'pointermove', async event => {
    if (scrubbing) await seek(event);
  });
  const finishScrub = async () => {
    if (!scrubbing) return;
    scrubbing = false;
    const resume = resumeAfterScrub;
    resumeAfterScrub = false;
    if (resume && !transport.running) await app.togglePlay();
  };
  on(elements.timeline, 'pointerup', finishScrub);
  on(elements.timeline, 'pointercancel', finishScrub);
  on(elements.timeline, 'keydown', async event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    app.state.resonances = [];
    await transport.seek(transport.position() + (event.key === 'ArrowRight' ? 1 : -1));
    scene.renderer.shadowDirty = true;
  });

  on(document, 'keydown', async event => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      await app.togglePlay();
    }
    if (event.key.toLowerCase() === 'r') app.reset();
    if (['1', '2', '3'].includes(event.key)) {
      document.querySelectorAll('[data-view]')[Number(event.key) - 1].click();
    }
  });
  on(document, 'visibilitychange', () => {
    if (document.hidden && transport.running) {
      app.pause();
      notifications.show('Playback paused while the tab was hidden.');
    }
  });
  on(elements.sceneCanvas, 'webglcontextlost', event => {
    event.preventDefault();
    app.pause();
    notifications.show(
      'The graphics context was lost. Reload this page to restore the scene.', true, 120000,
    );
  });
}
