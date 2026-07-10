import { ElementRef } from '@angular/core';
import * as L_import from 'leaflet';

const L = (L_import as any).default || L_import;

/** Leaflet bind target in map component templates — pair with .map-host CSS, never id="map". */
export const MAP_HOST_SELECTOR = ':scope .map-host';

export function mapContainer(host: ElementRef<HTMLElement>): HTMLElement | null {
  return host.nativeElement.querySelector(MAP_HOST_SELECTOR);
}

/** ngOnChanges can run before the host view exists; retry until .map-host is in the DOM. */
export function whenMapContainerReady(
  host: ElementRef<HTMLElement>,
  fn: (container: HTMLElement) => void,
  retryMs = 50
): void {
  const container = mapContainer(host);
  if (!container) {
    setTimeout(() => whenMapContainerReady(host, fn, retryMs), retryMs);
    return;
  }
  fn(container);
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
