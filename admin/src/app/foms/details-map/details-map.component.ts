import { Component, ElementRef, Injector, OnChanges, OnDestroy, OnInit, SimpleChanges, effect, inject, input } from '@angular/core';
import { SpatialFeaturePublicResponse, SubmissionTypeCodeEnum } from '@api-client';
import { MapLayers } from '@utility/models/map-layers';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { GeoJsonObject } from 'geojson';
import * as L_import from 'leaflet';
const L = (L_import as any).default || L_import;

/*
  The feature label marker exists only as a positioning anchor for its permanent tooltip, so it
  draws nothing itself. A zero-sized divIcon also keeps us off L.Icon.Default, whose path-guessing
  heuristic reads the bundled leaflet.css `.
*/
const labelAnchorIcon = L.divIcon({ className: '', html: '', iconSize: [0, 0] });

@Component({
    imports: [],
    selector: 'app-details-map',
    templateUrl: './details-map.component.html',
    styleUrl: './details-map.component.scss'
})
export class DetailsMapComponent implements OnInit, OnChanges, OnDestroy {
  private elementRef = inject(ElementRef);
  private fss = inject(FeatureSelectService);
  private injector = inject(Injector);
  private resizeObserver: ResizeObserver | null = null;


  readonly projectSpatialDetail = input<SpatialFeaturePublicResponse[]>();
  
  public map: L.Map;
  public projectFeatures: L.FeatureGroup; // group of layers for the features of a FOM project.
  private lastLabelMarker: L.Marker; // global variable to keep track latest layer added (as labeling popup for onClick)

  // Key for the map is: (spatialDetail.featureId + '-' + spatialDetail.featureType.code) so it is unique.
  private featureToLayerMap = new Map();

  // custom reset view control
  public resetViewControl = L.Control.extend({
    options: {
      position: 'bottomright'
    },
    onAdd: () => {
      const element = L.DomUtil.create('button');

      element.title = 'Reset view';
      element.innerText = 'refresh'; // material icon name
      element.addEventListener('click', () => this.fitBounds());
      element.className = 'material-icons map-reset-control';

      // prevent underlying map actions for these events
      L.DomEvent.disableClickPropagation(element); // includes double-click
      L.DomEvent.disableScrollPropagation(element);

      return element;
    }
  });

  ngOnInit(): void {
    this.subscribeToFeatureSelectChange();
  }

  public ngOnChanges(changes: SimpleChanges) {
    // Note, when Angular first onChange is triggered, the value is undefined.
    if (changes.projectSpatialDetail.currentValue) {
      this.resetMap();
      this.createMap();
    }
  }

  public createMap() {
    this.createBasicMap();
    this.addScale();
    this.addZoomControl();
    this.addResetViewControl();
    this.addFeatures();
    this.observeMapSizing();
  }

  public createBasicMap() {
    this.projectFeatures = L.featureGroup();

    const mapLayers = new MapLayers();    

    this.map = L.map('map', {
      layers: mapLayers.getAllLayers(),
      zoomControl: false, // will be added manually below
      attributionControl: true,
      doubleClickZoom: false, // not desired in thumbnail
      zoomSnap: 0.1, // for greater granularity when fitting bounds
      zoomDelta: 1, 
      maxZoom: MapLayers.MAX_ZOOM_LEVEL,
      minZoom: 5, // Most of BC on screen
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)) // restrict view to "the world"
    });

    this.map.on('blur', () => { this.map.scrollWheelZoom.disable(); });
    
    mapLayers.addLayerControl(this.map);
    this.map.on('baselayerchange', (e: L.LayersControlEvent) => {
      mapLayers.setActiveBaseLayerName(e.name);
    });

  }

  public addScale() {
    if (this.map) {
      L.control.scale({ position: 'topleft' }).addTo(this.map);
    }
  }

  public addZoomControl() {
    if (this.map) {
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    }
  }

  public addResetViewControl() {
    if (this.map) {
      this.map.addControl(new this.resetViewControl());
    }
  }

  public addFeatures() {
    if (this.map) {
      this.projectSpatialDetail()?.forEach(spatialDetail => {
        const layer = L.geoJSON(<GeoJsonObject>spatialDetail['geometry']);
        layer.on('click', L.Util.bind(this.onSpatialFeatureClick, this, spatialDetail));
        this.projectFeatures.addLayer(layer);
        this.map.on('zoomend', () => {
          const style: L.PathOptions = {};
          style.weight = 5; 
          if (this.map.getZoom() < 14) {
            style.weight = 2;
          } else if (this.map.getZoom() < 15) {
            style.weight = 3;
          } else if (this.map.getZoom() < 16) {
            style.weight = 4;
          }
          style.fillOpacity = 0.25;
          if (spatialDetail.submissionType.code == SubmissionTypeCodeEnum.Proposed) {
            style.dashArray = '10,10';
            if (this.map.getZoom() < 14) {
              style.dashArray = '7,7';
            }
          }
          if (spatialDetail.featureType.code == 'road_section') {
              style.color = 'yellow';
              style.opacity = 1;
          }
          if (spatialDetail.featureType.code == 'retention_area') {
            style.color = '#00DD06'; // Needs to be contrast with fill color, otherwise dashed lines won't be seen.
            style.fillColor = '#7CFF87';
          }
          layer.setStyle(style);

          this.featureToLayerMap.set((spatialDetail.featureId + '-' +spatialDetail.featureType.code), {
            layer: layer,
            detail: spatialDetail
          });
        });
      });
      this.map.addLayer(this.projectFeatures);
    }
  }

  private onSpatialFeatureClick(...args: any[]) {
    const spatialDetail = args[0] as SpatialFeaturePublicResponse;
    let label = spatialDetail.featureType.description + " " + spatialDetail.featureId;
    if (spatialDetail.name) { 
      label += " " + spatialDetail.name;
    }

    // Remove last label first, so it does not stay when next one is added.
    if (this.lastLabelMarker) this.projectFeatures.removeLayer(this.lastLabelMarker);

    // Invisible anchor marker, so just the label is visible.
    this.lastLabelMarker = L.marker(args[1].latlng, { icon: labelAnchorIcon });
    // Leaflet places a tooltip at (offset + the icon's tooltipAnchor). The anchor icon is zero-sized
    // and contributes [0, 0], so this offset alone lands the label on the clicked location. The old
    // [-15, 25] was cancelling out the default pin icon's [16, -28] tooltipAnchor; same net result.
    // See https://gis.stackexchange.com/questions/394960/marker-position-in-leaflet/395270#395270
    this.lastLabelMarker.bindTooltip(label, { permanent: true, offset: [1, -3] }); 
    this.projectFeatures.addLayer(this.lastLabelMarker);
  }

  // Keep the map sized to its container via a single ResizeObserver (initial layout +
  // every later resize), replacing the former 50ms offsetParent poll. The one-time
  // fitBounds runs on the first callback where the container is actually visible.
  // ref: https://github.com/Leaflet/Leaflet/issues/4835
  private observeMapSizing() {
    let didFit = false;
    this.resizeObserver = new ResizeObserver((entries) => {
      if (!this.map) {
        return;
      }
      this.map.invalidateSize();
      // Gate the one-time fitBounds on the observed map container actually having a size
      // (not the component host element, which can be zero-width even when the map is sized).
      const width = entries?.[0]?.contentRect.width ?? 0;
      if (!didFit && width > 0) {
        didFit = true;
        this.fitBounds();
      }
    });
    this.resizeObserver.observe(this.map.getContainer());
  }

  private fitBounds() {
    if (this.map) {
      const bounds = this.projectFeatures.getBounds();
      if (bounds && bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }

  public resetMap() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.map) {
      this.map.remove();
    }

    if (this.projectFeatures) {
      this.projectFeatures.remove();
    }
  }

  private subscribeToFeatureSelectChange(): void {
    effect(() => {
      const featureIndex = this.fss.currentSelected();
      const feature = featureIndex ? this.featureToLayerMap.get(featureIndex) : undefined;
      if (featureIndex && feature) {
        setTimeout(() => {
          const layer = feature.layer;
          const bound = layer.getBounds()
          this.map.flyToBounds(bound, { padding: [20, 20] });
          layer.bringToFront();
        }, 700); // Delay zoom timing for page scolling to top for user experience.
      }
    }, { injector: this.injector });
  }
  
  ngOnDestroy() {
    this.resetMap();
  }
}
