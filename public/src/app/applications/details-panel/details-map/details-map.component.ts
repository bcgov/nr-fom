import { Component, DestroyRef, ElementRef, Injector, OnChanges, OnDestroy, OnInit, SimpleChanges, afterNextRender, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpatialFeaturePublicResponse, SubmissionTypeCodeEnum } from '@api-client';
import { MapLayersService, OverlayAction } from '@public-core/services/mapLayers.service';
import { MapLayers } from '@utility/models/map-layers';
import { FeatureSelectService } from '@utility/services/featureSelect.service';
import { GeoJsonObject } from 'geojson';
import * as L_import from 'leaflet';
const L = (L_import as any).default || L_import;

import { destroyMap, initMap, mapContainer, observeMapSize } from '../../utils/leaflet-host';

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
  private mapLayersService = inject(MapLayersService);
  private fss = inject(FeatureSelectService);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private resizeObserver: ResizeObserver | null = null;


  readonly projectSpatialDetail = input<SpatialFeaturePublicResponse[] | undefined>(undefined);

  public map: L.Map | null = null;
  public projectFeatures: L.FeatureGroup; // group of layers for the features of a FOM project.
  private lastLabelMarker: L.Marker; // global variable to keep track latest layer added (as labeling popup for onClick)
  private mapLayers: MapLayers = new MapLayers();

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
    this.subscribeToMapLayersChange();
    this.subscribeToFeatureSelectChange();
  }

  public ngOnChanges(changes: SimpleChanges) {
    // Note, when Angular first onChange is triggered, the value is undefined.
    if (changes.projectSpatialDetail?.currentValue) {
      // ngOnChanges can fire before this component's view (and thus the .map-host
      // container) exists; afterNextRender runs once the DOM is painted, so no polling.
      afterNextRender(() => {
        this.resetMap();
        this.createMap();
      }, { injector: this.injector });
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
    const container = mapContainer(this.elementRef);
    if (!container) {
      return;
    }
    this.projectFeatures = L.featureGroup();   
    this.map = initMap(container, {
      layers: this.mapLayers.getAllLayers(),
      zoomControl: false, // will be added manually below
      attributionControl: true,
      doubleClickZoom: false, // not desired in thumbnail
      zoomSnap: 0.1, // for greater granularity when fitting bounds
      zoomDelta: 1, 
      maxZoom: MapLayers.MAX_ZOOM_LEVEL,
      minZoom: 5, // Most of BC on screen
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)) // restrict view to "the world"
    });

    this.mapLayers.addLayerControl(this.map);
    this.map.on('baselayerchange', (e: L.LayersControlEvent) => {
      if (e.name != this.mapLayers.getActiveBaseLayerName()) {
        this.mapLayers.setActiveBaseLayerName(e.name);
        this.mapLayersService.notifyLayersChange({baseLayer: e.name});
      }
    });
    this.map.on('overlayadd', (e: L.LayersControlEvent) => {
      this.mapLayersService.notifyLayersChange({overlay: {action: OverlayAction.Add, layerName: e.name}});
    });
    this.map.on('overlayremove', (e: L.LayersControlEvent) => {
      this.mapLayersService.notifyLayersChange({overlay: {action: OverlayAction.Remove, layerName: e.name}});
    });
    
    this.map.on('blur', () => { this.map?.scrollWheelZoom.disable(); });

    // Initialize current app-map layers state (for the first time when this component map is shown)
    this.mapLayersService.applyCurrentMapLayers(this.map, this.mapLayers);
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
    const projectSpatialDetails = this.projectSpatialDetail();
    const map = this.map;
    if (map && projectSpatialDetails) {
      projectSpatialDetails.forEach(spatialDetail => {
        const layer = L.geoJSON(<GeoJsonObject>spatialDetail['geometry']);
        layer.on('click', L.Util.bind(this.onSpatialFeatureClick, this, spatialDetail));
        this.projectFeatures.addLayer(layer);
        map.on('zoomend', () => {
            const style: L.PathOptions = {};
            style.weight = 5; 
            if (map.getZoom() < 14) {
                style.weight = 2;
            } else if (map.getZoom() < 15) {
                style.weight = 3;
            } else if (map.getZoom() < 16) {
                style.weight = 4;
            }
            style.fillOpacity = 0.25;
            if (spatialDetail.submissionType.code == SubmissionTypeCodeEnum.Proposed) {
                style.dashArray = '10,10';
            if (map.getZoom() < 14) {
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
      map.addLayer(this.projectFeatures);
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

  private observeMapSizing() {
    if (!this.map) return;
    this.resizeObserver = observeMapSize(this.map, () => this.fitBounds());
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
    destroyMap(this.map);
    this.map = null;

    if (this.projectFeatures) {
      this.projectFeatures.remove();
    }
  }
  
  private updateOnLayersChange(): void {
    if (!this.map) return;
    this.mapLayersService.mapLayersUpdate(this.map, this.mapLayers);
  }

  private subscribeToMapLayersChange(): void {
    this.mapLayersService.$mapLayersChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateOnLayersChange();
    });
  }

  private subscribeToFeatureSelectChange(): void {
    effect(() => {
      const featureIndex = this.fss.currentSelected();
      const feature = featureIndex ? this.featureToLayerMap.get(featureIndex) : undefined;
      if (featureIndex && feature) {
        setTimeout(() => {
          const layer = feature.layer;
          const bound = layer.getBounds()
          this.map?.flyToBounds(bound, { padding: [20, 20] });
          layer.bringToFront();
        }, 700); // Delay zoom timing for page scolling to top for user experience.
      }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.resetMap();
  }
}
