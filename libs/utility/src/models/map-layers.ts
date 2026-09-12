import * as L_import from 'leaflet';
const L = (L_import as any).default || L_import;

// Shared BC Geographic Warehouse (DataBC) OWS endpoint. Layer names are passed bare (no 'pub:' prefix).
const BCGW_WMS_URL = 'https://openmaps.gov.bc.ca/geo/ows';

const FDU_WMS_LAYER = 'WHSE_FOREST_TENURE.FSP_FDU_POLY_SPG';
const FDU_ATTRIBUTION = '&copy; Province of British Columbia (DataBC)';

/**
 * The four FDU life-cycle statuses, each with the published BCGW style that draws it.
 * Feature counts as at 2026-08 (whole province):
 *
 *   APPROVED   1417    2,591  - currently in force
 *   PREVIOUS   1418   19,571  - superseded amendments, retained for history
 *   DRAFT      1419      432  - not yet submitted
 *   SUBMITTED  1420      155  - awaiting decision
 */
const FDU_STATUS_STYLES = {
  APPROVED: '1417',
  PREVIOUS: '1418',
  DRAFT: '1419',
  SUBMITTED: '1420'
} as const;

type FduStatus = keyof typeof FDU_STATUS_STYLES;

/**
 * Which statuses the overlay draws and labels. Must list at least one.
 *
 * Why APPROVED only: the dataset keeps every historical amendment as its own polygon, and
 * PREVIOUS is 86% of it (19,571 of ~22,749). Those amendments stack on the same ground - a single
 * point near Prince George sits under 27 FDUs, 22 of them PREVIOUS copies of the same FSP at
 * amendments 43 through 61. Drawing them produces a mat of overlapping outlines, and labelling
 * them is unreadable. Restricting to APPROVED leaves 5 at that point, which renders cleanly.
 *
 * To show more, add them to this array and nothing else - the overlay name, the colour layer's
 * layers/styles pairing, and the label filter are all derived from it. For example
 * `['APPROVED', 'SUBMITTED']` yields an overlay named "Forest Development Units (Approved,
 * Submitted)" drawing both. Adding DRAFT (432) or SUBMITTED (155) stays legible; adding PREVIOUS
 * is what causes the mat described above, so expect to need labels off if you do.
 */
const FDU_SHOWN_STATUSES: FduStatus[] = ['APPROVED'];

/** Named for the statuses actually drawn, so the control does not imply it shows every FDU. */
const FDU_OVERLAY_NAME = 'Forest Development Units ('
  + FDU_SHOWN_STATUSES.map(status => status.charAt(0) + status.slice(1).toLowerCase()).join(', ') + ')';

/** An OGC filter restricting a request to FDU_SHOWN_STATUSES. */
function fduStatusFilter(): string {
  const tests = FDU_SHOWN_STATUSES.map(status =>
    '<ogc:PropertyIsEqualTo><ogc:PropertyName>LIFE_CYCLE_STATUS_CODE</ogc:PropertyName>'
    + '<ogc:Literal>' + status + '</ogc:Literal></ogc:PropertyIsEqualTo>').join('');
  return '<ogc:Filter>' + (FDU_SHOWN_STATUSES.length > 1 ? '<ogc:Or>' + tests + '</ogc:Or>' : tests) + '</ogc:Filter>';
}

/**
 * Label-only style, sent inline as `sld_body` because no published FDU style draws text -
 * 1417-1420 are colour-only. The published styles carry no filter of their own, so the colour
 * layer is restricted by style choice while the labels are restricted by this filter; both
 * derive from FDU_SHOWN_STATUSES so they cannot drift apart.
 *
 * Labelled with MAP_LABEL ("479 (0) -FDU1" = FSP id, amendment number, FDU name), which the
 * dataset supplies pre-formatted and which reads better than the raw numeric FDU_ID.
 */
const FDU_LABEL_SLD =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">' +
  '<NamedLayer><Name>pub:' + FDU_WMS_LAYER + '</Name><UserStyle><FeatureTypeStyle><Rule>' +
  fduStatusFilter() +
  '<TextSymbolizer>' +
  '<Label><ogc:PropertyName>MAP_LABEL</ogc:PropertyName></Label>' +
  '<Font><CssParameter name="font-family">SansSerif</CssParameter>' +
  '<CssParameter name="font-size">11</CssParameter>' +
  '<CssParameter name="font-weight">bold</CssParameter></Font>' +
  // White halo keeps the text legible over both the satellite and topographic base layers.
  '<Halo><Radius>2</Radius><Fill><CssParameter name="fill">#FFFFFF</CssParameter></Fill></Halo>' +
  '<Fill><CssParameter name="fill">#1A1A1A</CssParameter></Fill>' +
  '<VendorOption name="group">yes</VendorOption>' +
  '<VendorOption name="autoWrap">120</VendorOption>' +
  '<VendorOption name="spaceAround">10</VendorOption>' +
  '</TextSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';

/** L.WMSOptions has no `sld_body`; Leaflet forwards any unrecognised key straight into the GetMap query. */
type WmsLayerOptions = Partial<L.WMSOptions> & { sld_body?: string };

export class MapLayers {

  public static MAX_ZOOM_LEVEL = 18; // Maximum zoom level supported

  // The published FDU styles are scale-dependent: GetCapabilities reports ScaleHint max=989.95,
  // i.e. a max scale denominator of ~1:2,500,000. Zoomed out past that the server still answers
  // 200 image/png but the tile is entirely empty. Zoom 8 is the first level inside that threshold,
  // so below it we suppress the requests rather than fetch tiles that can only come back blank.
  public static FDU_MIN_ZOOM_LEVEL = 8;

  private baseLayers: { [key: string]: L.TileLayer } = {};
  private overlayLayers: { [key: string]: L.Layer } = {};

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
    // Colour fill and labels are separate WMS requests (the labels need their own SLD), grouped
    // so the layer control shows and toggles them as a single "Forest Development Units" entry.
    this.overlayLayers[FDU_OVERLAY_NAME] = L.layerGroup([
      // WMS pairs the Nth entry of `layers` with the Nth entry of `styles`, so drawing several
      // statuses at once means repeating the layer name once per style. With the default single
      // status this is simply the layer name and style 1417. See FDU_SHOWN_STATUSES to change it.
      this.createWmsLayer(
        new Array(FDU_SHOWN_STATUSES.length).fill(FDU_WMS_LAYER).join(','),
        FDU_SHOWN_STATUSES.map(status => FDU_STATUS_STYLES[status]).join(','),
        { attribution: FDU_ATTRIBUTION, minZoom: MapLayers.FDU_MIN_ZOOM_LEVEL }),
      // `styles` is intentionally empty: sld_body supplies the style. It must still carry a
      // non-empty `layers` - GeoServer accepts sld_body alongside it, but errors on `layers=`.
      this.createWmsLayer(FDU_WMS_LAYER, '',
        { minZoom: MapLayers.FDU_MIN_ZOOM_LEVEL, sld_body: FDU_LABEL_SLD })
    ]);

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

  getOverlayByName(name: string): L.Layer {
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
   * Builds an OGC WMS layer against the shared BCGW endpoint. Unlike createOverlay() it does not
   * register the result, so callers can combine several into one named overlay.
   * There is no maxNativeZoom: the server renders on demand at any scale.
   */
  private createWmsLayer(layers: string, styles: string, opts?: WmsLayerOptions): L.TileLayer {
    return L.tileLayer.wms(BCGW_WMS_URL, {
      layers: layers,
      styles: styles,
      format: 'image/png',
      transparent: true,
      maxZoom: MapLayers.MAX_ZOOM_LEVEL,
      ...opts
    });
  }
  
}
