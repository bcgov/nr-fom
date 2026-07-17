import { ElementRef } from '@angular/core';
import { destroyMap, initMap, mapContainer } from './leaflet-host';

jest.mock('leaflet', () => ({
  map: jest.fn((el: HTMLElement) => {
    (el as any)._leaflet_id = 1;
    return { remove: jest.fn(() => { delete (el as any)._leaflet_id; }) };
  }),
}));

describe('leaflet-host', () => {
  function hostWithMapDiv(): ElementRef<HTMLElement> {
    const root = document.createElement('div');
    const mapHost = document.createElement('div');
    mapHost.className = 'map-host';
    root.appendChild(mapHost);
    return new ElementRef(root);
  }

  it('mapContainer finds .map-host within the component host only', () => {
    expect(mapContainer(hostWithMapDiv())?.className).toBe('map-host');
    expect(mapContainer(new ElementRef(document.createElement('div')))).toBeNull();
  });

  it('initMap rejects double-init on the same container', () => {
    const el = document.createElement('div');
    initMap(el, {});
    expect(() => initMap(el, {})).toThrow(/already initialized/);
  });

  it('destroyMap clears leaflet id so the container can be re-used', () => {
    const el = document.createElement('div');
    const map = initMap(el, {});
    destroyMap(map as any);
    expect(() => initMap(el, {})).not.toThrow();
  });
});
