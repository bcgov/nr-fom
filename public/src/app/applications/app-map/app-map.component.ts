import {
    AfterViewInit, ApplicationRef, Component, ComponentFactoryResolver, ElementRef, EventEmitter, Injector, Input, OnChanges,
    OnDestroy, OnInit, Output, SimpleChanges
} from '@angular/core';
import { ProjectPlanCodeEnum, ProjectPublicSummaryResponse } from '@api-client';
import { MapLayersService, OverlayAction } from '@public-core/services/mapLayers.service';
import { UrlService } from '@public-core/services/url.service';
import { MapLayers } from '@utility/models/map-layers';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { differenceWith, findIndex, funnel } from 'remeda';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MarkerPopupComponent } from './marker-popup/marker-popup.component';

declare module 'leaflet' {
   
  export interface Marker<P = any> {
    dispositionId: number;
  }
}

const markerIcon = L.icon({
  iconUrl: 'assets/images/baseline-location-24px.svg',
  // Retina Icon is not needed here considering we're using an SVG. Enable if you want to change to a raster asset.
  // iconRetinaUrl: 'assets/images/marker-icon-2x-yellow.svg',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  tooltipAnchor: [16, -28]
});

@Component({
  standalone: true,
  selector: 'app-map',
  templateUrl: './app-map.component.html',
  styleUrls: ['./app-map.component.scss']
})
export class AppMapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() loading: boolean; // from projects component
  @Output() updateCoordinates = new EventEmitter(); // to applications component
  @Input() projectsSummary: Array<ProjectPublicSummaryResponse>; // from projects component

  private map: L.Map = null;
  private markerList: L.Marker[] = []; // list of markers
  private currentMarker: L.Marker = null; // for removing previous marker
  private markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40, // NB: change to 0 to disable clustering
    iconCreateFunction: this.clusterCreate
  });
  private isMapReady = false;
  private doNotify = true; // whether to emit notification
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  private mapLayers = new MapLayers();

  readonly defaultBounds = L.latLngBounds([48, -139], [60, -114]); // all of BC
  readonly projectPlanCodeEnum = ProjectPlanCodeEnum;
  
  constructor(
    private appRef: ApplicationRef,
    private elementRef: ElementRef,
    public urlService: UrlService,
    private injector: Injector,
    private resolver: ComponentFactoryResolver,
    private mapLayersService: MapLayersService
  ) { }

  ngOnInit(): void {
    this.mapLayersService.$mapLayersChange
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => {
        this.updateOnLayersChange();
    });
  }

  // create map after view (which contains map id) is initialized
  ngAfterViewInit() {
    this.onMapVisible();

    // custom control to reset map view
    const resetViewControl = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: () => {
        const element = L.DomUtil.create('button');

        element.title = 'Reset view';
        element.innerText = 'refresh'; // material icon name
        element.onclick = () => this.resetView();
        element.className = 'material-icons map-reset-control';

        // prevent underlying map actions for these events
        L.DomEvent.disableClickPropagation(element); // includes double-click
        L.DomEvent.disableScrollPropagation(element);

        return element;
      }
    });


    this.map = L.map('map', {
      zoomControl: false, // will be added manually below
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)), // restrict view to "the world"
      minZoom: 3, // prevent zooming out too far
      maxZoom: MapLayers.MAX_ZOOM_LEVEL,
      zoomSnap: 0.1, // for greater granularity when fitting bounds
      attributionControl: false
    });


    // identify when map has initialized with a view
    this.map.whenReady(() => (this.isMapReady = true));

    // map state change events
    // NB: moveend is called after zoomstart, movestart and resize
    // NB: fitBounds() also ends up here
    this.map.on('moveend', () => {
      // notify applications component of updated coordinates
      if (this.isMapReady && this.doNotify) {
        this.emitCoordinates.call();
      }
      this.doNotify = true; // reset for next time
    });

    // add markers group
    this.map.addLayer(this.markerClusterGroup);

    this.mapLayers.getAllLayers().forEach( layer => {
      this.map.addLayer(layer);
    })

    this.mapLayers.addLayerControl(this.map);

    // map attribution
    L.control.attribution({ position: 'bottomright' }).addTo(this.map);

    // add scale control
    L.control.scale({ position: 'bottomleft' }).addTo(this.map);

    // add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // add reset view control
    this.map.addControl(new resetViewControl());

    // save any future base layer changes
    this.map.on('baselayerchange', (e: L.LayersControlEvent) => {
      const layerName = e.name;
      if (layerName != this.mapLayers.getActiveBaseLayerName()) {
        this.mapLayers.setActiveBaseLayerName(layerName);
        this.mapLayersService.notifyLayersChange({baseLayer: layerName});
      }
    });
    this.map.on('overlayadd', (e: L.LayersControlEvent) => {
      this.mapLayersService.notifyLayersChange(
        {overlay: {action: OverlayAction.Add, layerName: e.name}}
      );
    });
    this.map.on('overlayremove', (e: L.LayersControlEvent) => {
      this.mapLayersService.notifyLayersChange(
        {overlay: {action: OverlayAction.Remove, layerName: e.name}}
      );
    });

    this.fixMap();
  }

  // for creating custom cluster icon
  private clusterCreate(cluster): L.Icon | L.DivIcon {
    const childCount = cluster.getChildCount();
    let c = ' marker-cluster-';
    if (childCount < 10) {
      c += 'small';
    } else if (childCount < 100) {
      c += 'medium';
    } else {
      c += 'large';
    }

    return new L.DivIcon({
      html: `<div><span title="${childCount} FOMs near this location">${childCount}</span></div>`,
      className: 'cluster-marker-count' + c,
      iconSize: new L.Point(48, 48),
      iconAnchor: [25, 46]
    });
  }

  // to avoid timing conflict with animations (resulting in small map tile at top left of page),
  // ensure map component is visible in the DOM then update it; otherwise wait a bit and try again
  // ref: https://github.com/Leaflet/Leaflet/issues/4835
  // ref: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
  private fixMap() {
    if (this.elementRef.nativeElement.offsetParent) {
      // try to restore map state
      const lat = this.urlService.getQueryParam('lat');
      const lng = this.urlService.getQueryParam('lng');
      const zoom = this.urlService.getQueryParam('zoom');

      if (lat && lng && zoom) {
        this.map.setView(L.latLng(+lat, +lng), +zoom); // NOTE: unary operators
      } else {
        this.fitBounds(); // default bounds
      }
    } else {
      setTimeout(this.fixMap.bind(this), 50);
    }
  }

  // called when projects list changes
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.projectsSummary && !changes.projectsSummary.firstChange && changes.projectsSummary.currentValue) {
      const ppsEqComparator = (a: ProjectPublicSummaryResponse, b: ProjectPublicSummaryResponse) => a.id == b.id;
      const deletedProjects = differenceWith(
        changes.projectsSummary.previousValue as Array<ProjectPublicSummaryResponse>,
        changes.projectsSummary.currentValue as Array<ProjectPublicSummaryResponse>,
        ppsEqComparator
      );

      const addedProjects = differenceWith(
        changes.projectsSummary.currentValue as Array<ProjectPublicSummaryResponse>,
        changes.projectsSummary.previousValue as Array<ProjectPublicSummaryResponse>,
        ppsEqComparator
      );

      // (re)draw the matching projects
      this.drawMap(deletedProjects, addedProjects);
    }
  }

  // when map becomes visible, draw all apps (rejected option to emit current bounds and cause a reload)
  public onMapVisible() {
    // delete any old apps
    this.markerList.forEach(marker => {
      this.markerClusterGroup.removeLayer(marker);
    });
    this.markerList = []; // empty the list 

    // draw all new apps
    this.drawMap([], this.projectsSummary);
  }

  public ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
    this.ngUnsubscribe.next(null);
    this.ngUnsubscribe.complete();
  }

  /**
   * Resets map view.
   */
  public resetView(doNotify: boolean = true) {
    if (this.map) {
      this.doNotify = doNotify;
      this.fitBounds(); // default bounds
    }

  }

  /**
   * Emits an event to notify applications component of updated coordinates.
   * Debounced function executes when 250ms have elapsed since last call.
   */
  private emitCoordinates = funnel(() => {
    this.updateCoordinates.emit();
  }, { minQuietPeriodMs: 250 });

  /**
   * Returns coordinates in GeoJSON format that specify map bounding box.
   */
  public getCoordinates(): string {
    let bounds: L.LatLngBounds;
    if (this.isMapReady && this.elementRef.nativeElement.offsetParent) {
      // actual bounds
      bounds = this.map.getBounds();
    } else {
      // map not ready yet - use default
      bounds = this.defaultBounds;
    }

    // use min/max to protect API from invalid bounds
    const west = Math.max(bounds.getWest(), -180);
    const south = Math.max(bounds.getSouth(), -90);
    const east = Math.min(bounds.getEast(), 180);
    const north = Math.min(bounds.getNorth(), 90);

    // return box parameters
    return `[[${this.latLngToCoord(south, west)},${this.latLngToCoord(north, east)}]]`;
  }

  private latLngToCoord(lat: number, lng: number): string {
    return `[${lng},${lat}]`;
  }

  // NB: do not animate fitBounds() as it can lead to getting
  // the latest apps BEFORE the final coordinates are set
  private fitBounds(bounds: L.LatLngBounds = null) {
    const fitBoundsOptions: L.FitBoundsOptions = {
      animate: false,
      paddingTopLeft: [0, 100],
      paddingBottomRight: [0, 20]
    };
    if (bounds && bounds.isValid()) {
      this.map.fitBounds(bounds, fitBoundsOptions);
    } else {
      this.map.fitBounds(this.defaultBounds, fitBoundsOptions);
    }
  }

  /**
   * Removes deleted / draws added FOMs.
   */
  private drawMap(deletedProjects: Array<ProjectPublicSummaryResponse>, addedProjects: Array<ProjectPublicSummaryResponse>) {
    // remove deleted projects from list and map
    deletedProjects.forEach(projectSummary => {
      const markerIndex = findIndex(this.markerList, (marker) => marker.dispositionId == projectSummary.id);
      if (markerIndex >= 0) {
        const markers = this.markerList.splice(markerIndex, 1);
        this.markerClusterGroup.removeLayer(markers[0]);
      }
    });
    
    addedProjects.forEach(projectSummary => {
      const commentingTxt = (projectSummary.workflowStateName === 'Finalized' || 
                           projectSummary.workflowStateName === 'Expired') ?
                          ', Commenting Closed': 
                          '';
      const fomProjectPlanTxt = (projectSummary.projectPlanCode == this.projectPlanCodeEnum.Fsp)? 
                                `FSP ID: ${projectSummary.fspId}`:
                                `Woodlot #: ${projectSummary.woodlotLicenseNumber}`

      const title = `${projectSummary.name}\n` + 
        `${projectSummary.forestClientName}\n` + 
        `${fomProjectPlanTxt}\n` +
        `${projectSummary.workflowStateName}${commentingTxt}`; // This will be Leaflet hover
      const marker = L.marker(L.latLng(projectSummary.geojson['coordinates'][1], projectSummary.geojson['coordinates'][0]), {title: title})
        .setIcon(markerIcon)
        .on('click', L.Util.bind(this.onMarkerClick, this, projectSummary));
        marker.dispositionId = projectSummary.id;
        this.markerList.push(marker);
        this.markerClusterGroup.addLayer(marker);
    });
  }

  private onMarkerClick(...args: any[]) {
    const projectSummary = args[0]; // as ProjectPublicSummary
    const marker = args[1].target as L.Marker;

    // if there's already a popup, delete it
    let popup = marker.getPopup();
    if (popup) {
      const wasOpen = popup.isOpen();
      popup.remove();
      marker.unbindPopup();
      if (wasOpen) {
        return;
      }
    }

    const popupOptions = {
      className: 'map-popup-content',
      autoPanPaddingTopLeft: L.point(40, 300),
      autoPanPaddingBottomRight: L.point(40, 20)
    };

    // compile marker popup component
    const compFactory = this.resolver.resolveComponentFactory(MarkerPopupComponent);
    const compRef = compFactory.create(this.injector);
    compRef.instance.projectSummary = projectSummary;
    this.appRef.attachView(compRef.hostView);
    compRef.onDestroy(() => this.appRef.detachView(compRef.hostView));
    const div = document.createElement('div').appendChild(compRef.location.nativeElement);

    popup = L.popup(popupOptions)
      .setLatLng(marker.getLatLng())
      .setContent(div);

    // bind popup to marker so it automatically closes when marker is removed
    marker.bindPopup(popup).openPopup();
  }

  public unhighlightApplications() {
    if (this.currentMarker) {
      this.currentMarker.setIcon(markerIcon);
      this.currentMarker = null;
    }
  }

  private updateOnLayersChange() {
    this.mapLayersService.mapLayersUpdate(this.map, this.mapLayers);
  }
}

