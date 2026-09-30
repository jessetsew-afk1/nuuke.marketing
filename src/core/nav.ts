/** Indirection so pages can navigate without importing the router (avoids cycles). */
export let navigate: (path: string) => void = (path) => {
  window.location.href = path;
};
export const setNavigate = (fn: (path: string) => void) => {
  navigate = fn;
};
