export function registerApplicationShell(workerUrl = "/service-worker.js") {
  if (!navigator.serviceWorker) {
    return;
  }

  window.addEventListener(
    "load",
    () => {
      void navigator.serviceWorker.register(workerUrl).catch(() => undefined);
    },
    { once: true },
  );
}
