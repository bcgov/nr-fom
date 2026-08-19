import * as L_import from 'leaflet';
const L = (L_import as any).default || L_import;

// Shared BC Geographic Warehouse (DataBC) OWS endpoint. Layer names are passed bare (no 'pub:' prefix).
const BCGW_WMS_URL = 'https://openmaps.gov.bc.ca/geo/ows';

export class MapLayers {

  public static MAX_ZOOM_LEVEL = 18; // Maximum zoom level supported

  // The published FDU styles are scale-dependent: GetCapabilities reports ScaleHint max=989.95,
  // i.e. a max scale denominator of ~1:2,500,000. Zoomed out past that the server still answers
  // 200 image/png but the tile is entirely empty. Zoom 8 is the first level inside that threshold,
  // so below it we suppress the requests rather than fetch tiles that can only come back blank.
  public static FDU_MIN_ZOOM_LEVEL = 8;

  private baseLayers: { [key: string]: L.TileLayer } = {};
  private overlayLayers: { [key: string]: L.TileLayer } = {};

  private defaultOverlays:L.TileLayer[] = [];

  private activeBaseLayerName: string;

  constructor() {
    const worldImageryLayerName = 'Satellite';
    this.activeBaseLayerName = worldImageryLayerName;
    this.createBaseLayer(worldImageryLayerName, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', 17);
    
    this.createBaseLayer('Topographic', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 
    'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community', 17);
 
    this.createBaseLayer('BC Web Mercator', 'https://maps.gov.bc.ca/arcgis/rest/services/province/web_mercator_cache/MapServer/tile/{z}/{y}/{x}',
    'GeoBC, DataBC, TomTom, &copy; OpenStreetMap contributors', 17);

    this.defaultOverlays.push(this.createOverlay('Places &amp; Boundaries', 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community', 20));

    this.defaultOverlays.push(this.createOverlay('Roads', 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', 
    'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community', 20));

    // Forest Development Units (BC Data Catalogue / DataBC).
    // Opt-in only: registered as an overlay so it appears in the layer control, but deliberately
    // NOT pushed to defaultOverlays, so it starts unchecked and costs nothing unless enabled.
    // The layer name is repeated once per style on purpose: WMS pairs the
    // Nth entry of `layers` with the Nth entry of `styles`, so this renders all four FDU statuses
    // (1417 Approved, 1418 Previous, 1419 Draft, 1420 Submitted) in a single request.
    const fduLayer = 'WHSE_FOREST_TENURE.FSP_FDU_POLY_SPG';
    this.createWmsOverlay('Forest Development Units',
      [fduLayer, fduLayer, fduLayer, fduLayer].join(','),
      '1417,1418,1419,1420',
      '&copy; Province of British Columbia (DataBC)',
      { minZoom: MapLayers.FDU_MIN_ZOOM_LEVEL });

  }

  setActiveBaseLayerName(newActiveBaseLayer:string) {
    this.activeBaseLayerName = newActiveBaseLayer;
  }

  getActiveBaseLayerName() {
    return this.activeBaseLayerName;
  }

  getActiveBaseLayer() : L.TileLayer {
    return this.baseLayers[this.getActiveBaseLayerName()];
  }

  getBaseLayerByName(name: string) : L.TileLayer {
    return this.baseLayers[name];
  }

  getOverlayByName(name: string): L.TileLayer {
    return this.overlayLayers[name];
  }

  getAllOverlayLayersNames() : string[] {
    return Object.keys(this.overlayLayers);
  }

  getAllLayers():L.TileLayer[] {
    return [ this.baseLayers[this.activeBaseLayerName], ...this.defaultOverlays];
  }

  addLayerControl(map: L.Map) {
    L.control.layers(this.baseLayers, this.overlayLayers, { position: 'topright' }).addTo(map);

  }

  private createBaseLayer(name: string, url: string, attribution: string, maxZoom: number):L.TileLayer {
    // Supplied max zoom is the maximum supported by the layer, we allow leaflet to scale it up to the maximum zoom level allowed.
    const layer = L.tileLayer(url, { attribution: attribution, maxNativeZoom: maxZoom, maxZoom: MapLayers.MAX_ZOOM_LEVEL, noWrap: true});
    this.baseLayers[name] = layer;
    return layer;
  }

  private createOverlay(name: string, url: string, attribution: string, maxZoom: number): L.TileLayer {
    // Supplied max zoom is the maximum supported by the layer, we allow leaflet to scale it up to the maximum zoom level allowed.
    const layer = L.tileLayer(url, { attribution: attribution, maxNativeZoom: maxZoom, maxZoom: MapLayers.MAX_ZOOM_LEVEL, noWrap: true});
    this.overlayLayers[name] = layer;
    return layer;
  }

  /**
   * Registers an OGC WMS overlay served from the shared BCGW endpoint.
   * L.TileLayer.WMS extends L.TileLayer, so the result slots into overlayLayers and the layer control unchanged.
   * Unlike createOverlay() there is no maxNativeZoom: the server renders on demand at any scale.
   */
  private createWmsOverlay(name: string, layers: string, styles: string, attribution: string,
    opts?: L.WMSOptions): L.TileLayer {
    const layer = L.tileLayer.wms(BCGW_WMS_URL, {
      layers: layers,
      styles: styles,
      format: 'image/png',
      transparent: true,
      maxZoom: MapLayers.MAX_ZOOM_LEVEL,
      attribution: attribution,
      ...opts
    });
    this.overlayLayers[name] = layer;
    return layer;
  }
  
}
