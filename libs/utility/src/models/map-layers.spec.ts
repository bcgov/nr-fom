/**
 * Leaflet touches `window` at module load, so this suite needs a DOM. Scoped here via the
 * docblock rather than in libs' jest config, to leave the other (node) suites untouched.
 *
 * @jest-environment jsdom
 */
import * as L_import from 'leaflet';
import { MapLayers } from "./map-layers";

const L = (L_import as any).default || L_import;

const FDU_OVERLAY_NAME = 'Forest Development Units (Approved)';
const FDU_WMS_LAYER = 'WHSE_FOREST_TENURE.FSP_FDU_POLY_SPG';

describe('MapLayers', () => {
    let mapLayers: MapLayers;

    /** The FDU overlay is a group of [colour, labels]; unwrap it for the per-layer assertions. */
    const fduGroup = (): any => mapLayers.getOverlayByName(FDU_OVERLAY_NAME) as any;
    const fduParts = (): any[] => (fduGroup() as L.LayerGroup).getLayers();
    const fduColour = (): any => fduParts()[0];
    const fduLabels = (): any => fduParts()[1];

    beforeEach(() => {
        mapLayers = new MapLayers();
    });

    describe('Forest Development Units overlay', () => {
        it('is named for the statuses it actually draws, not FDUs in general', () => {
            expect(mapLayers.getAllOverlayLayersNames()).toContain('Forest Development Units (Approved)');
        });

        it('is registered in the layer control overlays', () => {
            expect(mapLayers.getAllOverlayLayersNames()).toContain(FDU_OVERLAY_NAME);
            expect(mapLayers.getOverlayByName(FDU_OVERLAY_NAME)).toBeDefined();
        });

        it('is opt-in: not part of the layers added to the map by default', () => {
            expect(mapLayers.getAllLayers()).not.toContain(fduGroup());
        });

        it('still leaves the pre-existing default overlays enabled', () => {
            // Guards against the FDU registration accidentally displacing the existing defaults.
            const defaults = mapLayers.getAllLayers();
            expect(defaults).toContain(mapLayers.getOverlayByName('Places &amp; Boundaries'));
            expect(defaults).toContain(mapLayers.getOverlayByName('Roads'));
        });

        it('groups colour and labels behind a single layer-control entry', () => {
            // One entry in the control, so the two WMS requests toggle together.
            expect(fduParts().length).toBe(2);
            expect(mapLayers.getAllOverlayLayersNames().filter(n => n.includes('Forest Development')).length).toBe(1);
        });

        describe('colour layer', () => {
            it('draws approved units only, against the shared BCGW endpoint', () => {
                const colour = fduColour();
                expect(colour._url).toBe('https://openmaps.gov.bc.ca/geo/ows');
                expect(colour.wmsParams.layers).toBe(FDU_WMS_LAYER);
                // 1417 = Approved. Previous/Draft/Submitted are deliberately excluded: every
                // historical amendment is its own polygon, so including them is illegible.
                expect(colour.wmsParams.styles).toBe('1417');
            });

            it('pairs one layer entry per style entry', () => {
                // Guards the positional layers/styles pairing if FDU_SHOWN_STATUSES gains entries.
                const colour = fduColour();
                expect(colour.wmsParams.layers.split(',').length)
                    .toBe(colour.wmsParams.styles.split(',').length);
                colour.wmsParams.layers.split(',').forEach((name: string) => expect(name).toBe(FDU_WMS_LAYER));
            });

            it('matches the status the labels are filtered to', () => {
                // Colour and labels must agree, or units would be drawn with no label and vice versa.
                expect(fduColour().wmsParams.styles).toBe('1417');
                expect(fduLabels().wmsParams.sld_body).toContain('<ogc:Literal>APPROVED</ogc:Literal>');
            });

            it('requests transparent PNG tiles so the base map shows through', () => {
                expect(fduColour().wmsParams.format).toBe('image/png');
                expect(fduColour().wmsParams.transparent).toBe(true);
            });

            it('carries the DataBC attribution', () => {
                expect(fduColour().options.attribution).toContain('Province of British Columbia');
            });
        });

        describe('label layer', () => {
            it('supplies its own style inline, since no published FDU style draws text', () => {
                const labels = fduLabels();
                expect(labels.wmsParams.sld_body).toContain('<TextSymbolizer>');
                expect(labels.wmsParams.sld_body).toContain('MAP_LABEL');
                // Named by the SLD's NamedLayer, which must match the published (prefixed) name.
                expect(labels.wmsParams.sld_body).toContain('<Name>pub:' + FDU_WMS_LAYER + '</Name>');
            });

            it('labels only APPROVED units', () => {
                // Every historical amendment is its own polygon, so labelling all statuses is illegible.
                expect(fduLabels().wmsParams.sld_body).toContain('<ogc:Literal>APPROVED</ogc:Literal>');
            });

            it('sends an empty styles but a non-empty layers, which GeoServer requires', () => {
                // sld_body overrides `layers`, but `layers=` empty is rejected outright.
                expect(fduLabels().wmsParams.styles).toBe('');
                expect(fduLabels().wmsParams.layers).toBe(FDU_WMS_LAYER);
            });

            it('does not repeat the attribution already carried by the colour layer', () => {
                expect(fduLabels().options.attribution).toBeFalsy();
            });
        });

        it('suppresses both layers below the scale at which the styles render', () => {
            // The published styles are scale-dependent (~1:2,500,000); zoomed further out the
            // server returns an empty tile, so there is nothing to gain by requesting one.
            fduParts().forEach(layer => {
                expect(layer.options.minZoom).toBe(MapLayers.FDU_MIN_ZOOM_LEVEL);
                expect(layer.options.maxZoom).toBe(MapLayers.MAX_ZOOM_LEVEL);
            });
        });
    });
});
