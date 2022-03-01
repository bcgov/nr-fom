import { TileLayer, Map } from 'leaflet';

const L = window['L'];

export class MapLayers {

  public static MAX_ZOOM_LEVEL = 18; // Maximum zoom level supported

  private baseLayers = {};
  private overlayLayers = {};

  private defaultOverlays:TileLayer[] = [];

  private activeBaseLayerName;

  constructor() {
    const worldImageryLayerName = 'Satellite';
    this.activeBaseLayerName = worldImageryLayerName;
    this.createBaseLayer(worldImageryLayerName, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', 17);
    
    this.createBaseLayer('Topographic', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', 
    'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community', 17);
    
    this.createBaseLayer('National Geographic', 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC', 12);
    
    this.createBaseLayer('BC Web Mercator', 'https://maps.gov.bc.ca/arcgis/rest/services/province/web_mercator_cache/MapServer/tile/{z}/{y}/{x}',
    'GeoBC, DataBC, TomTom, &copy; OpenStreetMap contributors', 17);

    this.defaultOverlays.push(this.createOverlay('Places &amp; Boundaries', 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community', 20));

    this.defaultOverlays.push(this.createOverlay('Roads', 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', 
    'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community', 20));

  }

  setActiveBaseLayerName(newActiveBaseLayer:string) {
    this.activeBaseLayerName = newActiveBaseLayer;
  }

  getActiveBaseLayerName() {
    return this.activeBaseLayerName;
  }

  getActiveBaseLayer() : TileLayer {
    return this.baseLayers[this.getActiveBaseLayerName()];
  }

  getBaseLayerByName(name: string) : TileLayer {
    return this.baseLayers[name];
  }

  getOverlayByName(name: string): TileLayer {
    return this.overlayLayers[name];
  }

  getAllLayers():TileLayer[] {
    return [ this.baseLayers[this.activeBaseLayerName], ...this.defaultOverlays];
  }

  addLayerControl(map: Map) {
    L.control.layers(this.baseLayers, this.overlayLayers, { position: 'topright' }).addTo(map);

  }

  private createBaseLayer(name: string, url: string, attribution: string, maxZoom: number):TileLayer {
    // Supplied max zoom is the maximum supported by the layer, we allow leaflet to scale it up to the maximum zoom level allowed.
    const layer = L.tileLayer(url, { attribution: attribution, maxNativeZoom: maxZoom, maxZoom: MapLayers.MAX_ZOOM_LEVEL, noWrap: true});
    this.baseLayers[name] = layer;
    return layer;
  }

  private createOverlay(name: string, url: string, attribution: string, maxZoom: number): TileLayer {
    // Supplied max zoom is the maximum supported by the layer, we allow leaflet to scale it up to the maximum zoom level allowed.
    const layer = L.tileLayer(url, { attribution: attribution, maxNativeZoom: maxZoom, maxZoom: MapLayers.MAX_ZOOM_LEVEL, noWrap: true});
    this.overlayLayers[name] = layer;
    return layer;
  }
  
}
