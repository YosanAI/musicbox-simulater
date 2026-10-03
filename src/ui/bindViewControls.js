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
  on(elements.explodeBtn, 'click', () => {
    scene.setExploded(!scene.exploded);
    elements.explodeBtn.classList.toggle('active', scene.exploded);
    elements.explodeBtn.setAttribute('aria-pressed', String(scene.exploded));
    elements.explodeBtn.textContent = scene.exploded ? 'Assemble' : 'Explode';
    elements.explodeBtn.setAttribute('aria-label', scene.exploded
      ? 'Assemble the mechanism' : 'Explode the mechanism');
    for (const button of views) {
      button.classList.toggle('active', !scene.exploded && button.dataset.view === 'perspective');
    }
  });
  on(elements.fullBtn, 'click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (elements.sceneStage.requestFullscreen) {
      await elements.sceneStage.requestFullscreen();
    } else notifications.show('Fullscreen is not supported by this browser.');
  });
  on(document, 'fullscreenchange', () => {
    const fullscreen = document.fullscreenElement === elements.sceneStage;
    elements.fullBtn.classList.toggle('active', fullscreen);
    elements.fullBtn.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Toggle fullscreen');
  });
  on(elements.guideBtn, 'click', () => elements.guideDialog.showModal());
  on(elements.copyPromptBtn, 'click', async () => {
    try {
      await navigator.clipboard.writeText(elements.cylinderPrompt.value);
      elements.promptCopyStatus.textContent = 'Prompt copied. Replace [MELODY NAME] in your AI chat.';
    } catch {
      elements.cylinderPrompt.focus();
      elements.cylinderPrompt.select();
      elements.promptCopyStatus.textContent = 'Prompt selected. Use your device’s Copy command to copy it.';
    }
  });
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
