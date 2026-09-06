/**
 * Emergency escape hatch check for preload extensions (ext.ember / ext.net).
 * If no_preload_ext=1 is specified in loader config (exposed via window.Pengu.no_preload_ext),
 * in location.search, or in localStorage, all preload hooks are bypassed.
 */
export function isPreloadExtDisabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const pengu = (window as any).Pengu;
      if (pengu && (pengu.no_preload_ext === true || pengu.noPreloadExt === true || pengu.no_preload_ext === '1')) {
        return true;
      }
      if (typeof location !== 'undefined' && location.search && /no_preload_ext=1(&|$)/.test(location.search)) {
        return true;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('no_preload_ext') === '1') {
        return true;
      }
    }
  } catch {}
  return false;
}
