type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export async function toggleFullscreen(element: HTMLElement = document.documentElement) {
  const fullscreenDocument = document as FullscreenDocument;
  const fullscreenElement = element as FullscreenElement;

  if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    await fullscreenDocument.webkitExitFullscreen?.();
    return;
  }

  if (element.requestFullscreen) {
    await element.requestFullscreen({ navigationUI: "hide" });
    return;
  }
  if (fullscreenElement.webkitRequestFullscreen) {
    await fullscreenElement.webkitRequestFullscreen();
    return;
  }

  throw new Error("fullscreen-not-supported");
}
