import { ElementRef } from '@angular/core';
import * as L_import from 'leaflet';

const L = (L_import as any).default || L_import;

/** Leaflet bind target in map component templates — pair with .map-host CSS, never id="map". */
export const MAP_HOST_SELECTOR = ':scope .map-host';

export function mapContainer(host: ElementRef<HTMLElement>): HTMLElement | null {
  return host.nativeElement.querySelector(MAP_HOST_SELECTOR);
}

export function initMap(container: HTMLElement, options: L.MapOptions): L.Map {
  // ponytail: double-init caused filter-freeze when two maps shared getElementById('map')
  if ((container as any)._leaflet_id != null) {
    throw new Error('Leaflet map already initialized on this container');
  }
  return L.map(container, options);
}

export function destroyMap(map: L.Map | null | undefined): void {
  map?.remove();
}

/**
 * Keep a Leaflet map sized to its container. Calls `invalidateSize()` on the initial layout
 * and on every later resize (window resize, side-panel open/close, flex settle), and runs
 * `onFirstSized` exactly once — on the first callback where the container actually has a width
 * — for the one-time initial view (`fitBounds` / `setView`). Gating on the observed container's
 * width (not the component host element, which can be zero-width even when the map is sized).
 * Returns the observer; the caller must `disconnect()` it on teardown / before recreating the map.
 * ref: https://github.com/Leaflet/Leaflet/issues/4835
 */
export function observeMapSize(map: L.Map, onFirstSized: () => void): ResizeObserver {
  let firstSizedApplied = false;
  const observer = new ResizeObserver((entries) => {
    map.invalidateSize();
    const width = entries?.[0]?.contentRect.width ?? 0;
    if (!firstSizedApplied && width > 0) {
      firstSizedApplied = true;
      onFirstSized();
    }
  });
  observer.observe(map.getContainer());
  return observer;
}
