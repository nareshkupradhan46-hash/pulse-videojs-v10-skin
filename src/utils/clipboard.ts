export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback for restricted iframes / Safari / Firefox permissions
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.fontSize = '16px';

  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, text.length);
    }
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus({ preventScroll: true });
      } catch {
        // Ignore focus restore error
      }
    }
  }
}
