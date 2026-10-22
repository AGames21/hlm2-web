export function fittedSize(width, height, availableWidth, availableHeight) {
  if (Math.min(width, height, availableWidth, availableHeight) <= 0) return { width: 0, height: 0 };
  const scale = Math.min(availableWidth / width, availableHeight / height);
  return { width: width * scale, height: height * scale };
}

export function setupFullscreen(canvas, view, button, exitButton, onError) {
  const resize = () => {
    if (!document.fullscreenElement) return;
    const size = fittedSize(canvas.width, canvas.height, view.clientWidth, view.clientHeight);
    canvas.style.setProperty('--fullscreen-width', size.width + 'px');
    canvas.style.setProperty('--fullscreen-height', size.height + 'px');
  };
  const sync = () => {
    const active = !!document.fullscreenElement;
    button.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
    button.setAttribute('aria-pressed', String(active));
    exitButton.hidden = !active;
    resize();
  };
  button.disabled = !document.fullscreenEnabled;
  if (button.disabled) button.title = 'Fullscreen is unavailable in this browser or embedded page.';
  button.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) { onError('Fullscreen unavailable: ' + error.message); }
  };
  exitButton.onclick = () => document.exitFullscreen().catch(error => onError(error.message));
  document.addEventListener('fullscreenchange', sync);
  new ResizeObserver(resize).observe(view);
  new MutationObserver(resize).observe(canvas, { attributes: true, attributeFilter: ['width', 'height', 'hidden'] });
  sync();
}
