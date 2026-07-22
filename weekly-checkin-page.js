const routes = new Map();

export function registerRoute(path, renderer) {
  routes.set(path, renderer);
}

export function navigate(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  } else {
    renderCurrentRoute();
  }
}

export function renderCurrentRoute() {
  const path = window.location.hash.replace(/^#/, "") || "/";
  const renderer = routes.get(path) || routes.get("/404");
  renderer?.();
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrentRoute);
  renderCurrentRoute();
}
