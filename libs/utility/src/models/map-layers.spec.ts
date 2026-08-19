/**
 * Leaflet touches `window` at module load, so this suite needs a DOM. Scoped here via the
 * docblock rather than in libs' jest config, to leave the other (node) suites untouched.
 *
 * @jest-environment jsdom
 */
import { MapLayers } from "./map-layers";

const FDU_OVERLAY_NAME = 'Forest Development Units';
const FDU_WMS_LAYER = 'WHSE_FOREST_TENURE.FSP_FDU_POLY_SPG';

describe('MapLayers', () => {
    let mapLayers: MapLayers;

    beforeEach(() => {
        mapLayers = new MapLayers();
    });

    describe('Forest Development Units overlay', () => {
        it('is registered in the layer control overlays', () => {
            expect(mapLayers.getAllOverlayLayersNames()).toContain(FDU_OVERLAY_NAME);
            expect(mapLayers.getOverlayByName(FDU_OVERLAY_NAME)).toBeDefined();
        });

        it('is opt-in: not part of the layers added to the map by default', () => {
            const fdu = mapLayers.getOverlayByName(FDU_OVERLAY_NAME);
            expect(mapLayers.getAllLayers()).not.toContain(fdu);
        });

        it('still leaves the pre-existing default overlays enabled', () => {
            // Guards against the FDU registration accidentally displacing the existing defaults.
            const defaults = mapLayers.getAllLayers();
            expect(defaults).toContain(mapLayers.getOverlayByName('Places &amp; Boundaries'));
            expect(defaults).toContain(mapLayers.getOverlayByName('Roads'));
        });

        it('requests all four status styles against the shared BCGW endpoint', () => {
            const fdu = mapLayers.getOverlayByName(FDU_OVERLAY_NAME) as any;
            expect(fdu._url).toBe('https://openmaps.gov.bc.ca/geo/ows');
            // One layer entry per style entry - WMS pairs them positionally.
            expect(fdu.wmsParams.layers).toBe([FDU_WMS_LAYER, FDU_WMS_LAYER, FDU_WMS_LAYER, FDU_WMS_LAYER].join(','));
            expect(fdu.wmsParams.styles).toBe('1417,1418,1419,1420');
            expect(fdu.wmsParams.layers.split(',').length).toBe(fdu.wmsParams.styles.split(',').length);
        });

        it('requests transparent PNG tiles so the base map shows through', () => {
            const fdu = mapLayers.getOverlayByName(FDU_OVERLAY_NAME) as any;
            expect(fdu.wmsParams.format).toBe('image/png');
            expect(fdu.wmsParams.transparent).toBe(true);
        });

        it('is suppressed below the scale at which the published styles render', () => {
            // The styles are scale-dependent (~1:2,500,000); zoomed further out the server
            // returns an empty tile, so there is nothing to gain by requesting one.
            const fdu = mapLayers.getOverlayByName(FDU_OVERLAY_NAME);
            expect(fdu.options.minZoom).toBe(MapLayers.FDU_MIN_ZOOM_LEVEL);
            expect(fdu.options.maxZoom).toBe(MapLayers.MAX_ZOOM_LEVEL);
        });
    });
});
