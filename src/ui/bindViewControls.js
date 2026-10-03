export function bindViewControls(app) {
  const { elements, events, notifications, scene, state } = app;
  const on = (element, type, action) => events.on(element, type, notifications.guard(action));
  const views = document.querySelectorAll('[data-view]');
  for (const button of views) {
    on(button, 'click', () => {
      scene.view(button.dataset.view);
      for (const other of views) other.classList.toggle('active', other === button);
    });
  }

  on(elements.labelsBtn, 'click', () => {
    state.labelsOn = !state.labelsOn;
    elements.labels.hidden = !state.labelsOn;
    elements.labelsBtn.classList.toggle('active', state.labelsOn);
  });
  on(elements.fullBtn, 'click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else notifications.show('Fullscreen is not supported by this browser.');
  });
  on(elements.guideBtn, 'click', () => elements.guideDialog.showModal());
  for (const button of document.querySelectorAll('.close-dialog')) {
    on(button, 'click', () => button.closest('dialog').close());
  }
  for (const dialog of document.querySelectorAll('dialog')) {
    on(dialog, 'click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
  }
}
