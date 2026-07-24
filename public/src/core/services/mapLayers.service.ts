import { Injectable } from "@angular/core";
import { MapLayers } from '@utility/models/map-layers';
import { BehaviorSubject } from "rxjs";

export const OverlayAction = {
  Add: 'ADD',
  Remove: 'REMOVE'
}

interface MapLayersChangeState {
  baseLayer: string | null;
  overlay: { action: string; layerName: string } | null;
}

@Injectable({
  providedIn: 'root'
})
export class MapLayersService {

  // Value passing for next(?):
  // - For baseLayer change: {baseLayer: string}
  // - For overlay change: {overlay: {action: 'ADD'|'REMOVE', layerName: string}}
  private _mapLayersChange = new BehaviorSubject<MapLayersChangeState>({baseLayer: null, overlay: null});
  $mapLayersChange = this._mapLayersChange.asObservable();

  // Internally maintain overlay layers.
  // Some component needs this initially.
  private _overlayLayers: string[] = [];
  
  constructor () { 
    // Deliberately empty 
  }

  getCurrentChangeState() {
    return this._mapLayersChange.value;
  }

  /**
   * To notify observable there is a new change.
   * The function reconstructs the new change and emit it to next();
   * @param data The 'data' passing into this function if of the form:
   *              either {baseLayer: string}
   *              or {overlay: {action: 'ADD'|'REMOVE', layerName: string}}
   */
  notifyLayersChange(data: Partial<MapLayersChangeState>) {
    const newLayersChange = Object.assign({}, this._mapLayersChange.value);
    if (data.baseLayer) {
      newLayersChange['baseLayer'] = data.baseLayer;
    }
    if (data.overlay) {
      const overlay = data.overlay;
      newLayersChange['overlay'] = overlay;
      // maintain internal overlay state.
      if (overlay.action == OverlayAction.Add) {
        this._overlayLayers.push(overlay.layerName);
      }
      else {
        this._overlayLayers = this._overlayLayers.filter(e => e !== overlay.layerName);
      }
    }

    this._mapLayersChange.next(newLayersChange);
  }

  /**
   * A convenient function for the component which subscribe to $mapLayersChange
   * observable to do the map layers update when it gets notified.
   * @param map map of the component.
   * @param componentMapLayers MapLayers instance fom the component.
   */
  mapLayersUpdate(map: L.Map, componentMapLayers: MapLayers) {
    const changeState = this.getCurrentChangeState();
    if (changeState.baseLayer) {
      const currentActiveBaseLayer = componentMapLayers.getActiveBaseLayer();
      const newBaseLayer = componentMapLayers.getBaseLayerByName(changeState.baseLayer);
      map.removeLayer(currentActiveBaseLayer);
      map.addLayer(newBaseLayer);
    }
    if (changeState.overlay) {
      const overlay = componentMapLayers.getOverlayByName(changeState.overlay.layerName);
      if (changeState.overlay.action == OverlayAction.Add) {
        map.addLayer(overlay);
      }
      else {
        map.removeLayer(overlay);
      }
    }
  }

  /**
   * Special case for the first time when the component map is shown, see component (like details-map.component.ts).
   * @param map map of the component.
   * @param componentMapLayers MapLayers instance fom the component.
   */
  applyCurrentMapLayers(map: L.Map, componentMapLayers: MapLayers) {
    // For base layer
    const baseLayer = this.getCurrentChangeState().baseLayer;
    if (baseLayer) {
      const currentActiveBaseLayer = componentMapLayers.getActiveBaseLayer();
      const newBaseLayer = componentMapLayers.getBaseLayerByName(baseLayer);
      map.removeLayer(currentActiveBaseLayer);
      map.addLayer(newBaseLayer);
    }

    // For overlay layers
    const overlayLayersNames = componentMapLayers.getAllOverlayLayersNames();
    overlayLayersNames.forEach(oln => {
      const overlay = componentMapLayers.getOverlayByName(oln);
      if (this._overlayLayers.includes(oln)) {
        map.addLayer(overlay);
      }
      else {
        map.removeLayer(overlay);
      }
    });
  }
}
