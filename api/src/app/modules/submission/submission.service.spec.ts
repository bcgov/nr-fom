import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { SubmissionService } from './submission.service';
import { FomSpatialJson, SpatialCoordSystemEnum, SpatialObjectCodeEnum } from './submission.dto';
import { Geometry } from 'geojson';
import { User } from '@utility/security/user';
import { CutBlock } from './cut-block.entity';
import { RoadSection } from './road-section.entity';

describe('SubmissionService', () => {
  let service: SubmissionService;

  beforeEach(async () => {
    service = new SubmissionService(null, mockLoggerFactory(), null, null);
  });

  describe('detectSpatialSubmissionCoordRef', () => {
    let simpleOneFeatureSpatialSubmission: FomSpatialJson;
    const geometry_BCAlbers = {"type":"Polygon","coordinates":[[[1474614.5923999995,555392.2415999994],[1474537.8630999997,555275.8246999998],[1474588.1340999994,555146.1786000002],[1474723.071799999,555080.0326000005],[1474818.3220000006,555138.2411000002],[1474902.9889000002,555220.2620999999],[1474818.3220000006,555334.0330999997],[1474701.9050999992,555437.2207999993],[1474614.5923999995,555392.2415999994]]]};
    const geometry_WGS84 = {"type":"Polygon","coordinates":[[[-119.397280854,49.815298833],[-119.394459294,49.815127941],[-119.394863101,49.812334408],[-119.39768449,49.812505292],[-119.397280854,49.815298833]]]};

    beforeEach(async () => {
      simpleOneFeatureSpatialSubmission  = {"type":"FeatureCollection", "features":[{"type":"Feature","geometry":null,"properties":{"DEVELOPMENT_DATE":"2022-03-30","NAME":"Nature's valley"}}]} as FomSpatialJson;
    })

    it ('spatial submission contains crs field (EPSG:3005) should return 3005', async () => {
      simpleOneFeatureSpatialSubmission.crs = {"type":"name","properties":{"name":"EPSG:3005"}};
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.BC_ALBERS);
    });

    it ('spatial submission contains crs field (urn:ogc:def:crs:EPSG::3005) should return 3005', async () => {
      simpleOneFeatureSpatialSubmission.crs = {"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::3005"}};
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.BC_ALBERS);
    });

    it ('spatial submission contains crs field (EPSG:4326) should return 4326', async () => {
      simpleOneFeatureSpatialSubmission.crs = {"type":"name","properties":{"name":"EPSG:4326"}};
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.WGS84);
    });

    it ('spatial submission contains crs field (urn:ogc:def:crs:EPSG::4326) should return 4326', async () => {
      simpleOneFeatureSpatialSubmission.crs = {"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::4326"}};
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.WGS84);
    });

    it ('spatial submission contains no crs field, but with BC Albers\'s geometry range should return 3005', async () => {
      delete simpleOneFeatureSpatialSubmission.crs;
      simpleOneFeatureSpatialSubmission.features[0].geometry = geometry_BCAlbers as Geometry;
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.BC_ALBERS);
    });
    
    it ('spatial submission contains no crs field, but with WGS84 geometry range should return 4326', async () => {
      delete simpleOneFeatureSpatialSubmission.crs;
      simpleOneFeatureSpatialSubmission.features[0].geometry = geometry_WGS84 as Geometry;
      expect(service.detectSpatialSubmissionCoordRef(simpleOneFeatureSpatialSubmission)).toBe(SpatialCoordSystemEnum.WGS84);
    });
  });

  /* Test is commented out as it is an integration test that requires db conntion in test environment.
  describe('convertGeometry', () => {
    let geometryJson: string;
    let conversionSrid: number;
    const geometry_BCAlbers = {"type":"Polygon","crs":{"type":"name","properties":{"name":"EPSG:3005"}},"coordinates":[[[1474613.999997578,555391.999955864],[1474818.000019682,555392.000057264],[1474818.000027833,555079.999953587],[1474614.000024779,555080.000049848],[1474613.999997578,555391.999955864]]]};
    const geometry_WGS84 = {"type":"Polygon","coordinates":[[[-119.397280854,49.815298833],[-119.394459294,49.815127941],[-119.394863101,49.812334408],[-119.39768449,49.812505292],[-119.397280854,49.815298833]]]};

    beforeEach(async () => {
      geometryJson = null;
      conversionSrid = null;
    })

    it ('convert geometry from BC Albers to WGS84', async () => {
      geometryJson = JSON.stringify(geometry_BCAlbers);
      conversionSrid = SpatialCoordSystemEnum.WGS84;
      expect(await service.convertGeometry(geometryJson, conversionSrid)).toBe(JSON.stringify(geometry_WGS84));
    });

    it ('convert geometry from WGS84 to BC Albers', async () => {
      geometryJson = JSON.stringify(geometry_WGS84);
      conversionSrid = SpatialCoordSystemEnum.BC_ALBERS;
      expect(await service.convertGeometry(geometryJson, conversionSrid)).toBe(JSON.stringify(geometry_BCAlbers));
    });

    // case when geometry is not convertable and throw error from db.
  });
  */

  /**
   * DEV_DATE (legacy name DEVELOPMENT_DATE) validation, exercised through the public
   * parseFomSpatialSubmission. BC Albers geometry is used deliberately so no coordinate
   * conversion is attempted and the tests need no database connection.
   */
  describe('DEV_DATE validation', () => {
    const user = { userName: 'tester' } as User;
    const polygon_BCAlbers = {"type":"Polygon","coordinates":[[[1474614.5923999995,555392.2415999994],[1474537.8630999997,555275.8246999998],[1474588.1340999994,555146.1786000002],[1474723.071799999,555080.0326000005],[1474614.5923999995,555392.2415999994]]]};
    const lineString_BCAlbers = {"type":"LineString","coordinates":[[1474614.5923999995,555392.2415999994],[1474537.8630999997,555275.8246999998],[1474588.1340999994,555146.1786000002]]};

    // Cut blocks and retention areas are Polygons, road sections are LineStrings.
    const geometryFor = (spatialObjectCode: SpatialObjectCodeEnum) =>
      spatialObjectCode === SpatialObjectCodeEnum.ROAD_SECTION ? lineString_BCAlbers : polygon_BCAlbers;

    const submissionWith = (spatialObjectCode: SpatialObjectCodeEnum, properties: any): FomSpatialJson =>
      ({
        type: 'FeatureCollection',
        crs: {"type":"name","properties":{"name":"EPSG:3005"}},
        features: [{ type: 'Feature', geometry: geometryFor(spatialObjectCode), properties }]
      }) as unknown as FomSpatialJson;

    const parse = (spatialObjectCode: SpatialObjectCodeEnum, properties: any) =>
      service.parseFomSpatialSubmission(spatialObjectCode, submissionWith(spatialObjectCode, properties), user);

    // Both spatial object types share the same DEV_DATE rules, so each case runs against both.
    const dateRequiredTypes = [SpatialObjectCodeEnum.CUT_BLOCK, SpatialObjectCodeEnum.ROAD_SECTION];

    describe.each(dateRequiredTypes)('%s', (spatialObjectCode) => {

      it.each([
        ['DEV_DATE in the required format', { DEV_DATE: '2023-06-07' }],
        ['legacy DEVELOPMENT_DATE property', { DEVELOPMENT_DATE: '2023-06-07' }],
        ['Feb 29 of a leap year', { DEV_DATE: '2024-02-29' }],
      ])('accepts %s', async (_label, properties) => {
        await expect(parse(spatialObjectCode, properties)).resolves.toHaveLength(1);
      });

      it.each([
        // Previously accepted by the lenient parse and silently coerced. '2026-13-45' was the
        // worst case: it rolled forward and was stored as 2027-02-14.
        ['month and day out of range', { DEV_DATE: '2026-13-45' }],
        ['a day that does not exist in the month', { DEV_DATE: '2026-02-30' }],
        ['Feb 29 of a non leap year', { DEV_DATE: '2023-02-29' }],
        ['slash separators', { DEV_DATE: '2023/06/07' }],
        ['a full ISO timestamp', { DEV_DATE: '2026-08-11T10:00:00Z' }],
        // Rejected before the strict change as well, kept to pin the whole accepted set.
        ['no separators', { DEV_DATE: '20230607' }],
        ['day and month transposed', { DEV_DATE: '06-07-2023' }],
        ['unpadded month and day', { DEV_DATE: '2026-8-11' }],
        ['an empty value', { DEV_DATE: '' }],
        ['a null value', { DEV_DATE: null }],
      ])('rejects %s', async (_label, properties) => {
        await expect(parse(spatialObjectCode, properties)).rejects.toThrow(/DEV_DATE has an invalid value/);
      });

      it('rejects a feature with no DEV_DATE property', async () => {
        await expect(parse(spatialObjectCode, { NAME: 'Somewhere' }))
          .rejects.toThrow(`Required property DEV_DATE missing for ${spatialObjectCode} 'Somewhere' (feature #1).`);
      });

      it('rejects a feature with no properties at all', async () => {
        await expect(parse(spatialObjectCode, {}))
          .rejects.toThrow(`Required Feature object 'properties' missing for ${spatialObjectCode} feature #1.`);
      });
    });

    it('keeps a valid DEV_DATE on the parsed cut block', async () => {
      const [cutBlock] = await parse(SpatialObjectCodeEnum.CUT_BLOCK, { NAME: 'Block A', DEV_DATE: '2023-06-07' });
      expect((cutBlock as CutBlock).plannedDevelopmentDate).toBe('2023-06-07');
    });

    it('keeps a valid legacy DEVELOPMENT_DATE on the parsed road section', async () => {
      const [roadSection] = await parse(SpatialObjectCodeEnum.ROAD_SECTION, { DEVELOPMENT_DATE: '2023-06-07' });
      expect((roadSection as RoadSection).plannedDevelopmentDate).toBe('2023-06-07');
    });

    it('does not require DEV_DATE for WTRA', async () => {
      await expect(parse(SpatialObjectCodeEnum.WTRA, { NAME: 'Retention 1' })).resolves.toHaveLength(1);
    });

    it('ignores an invalid DEV_DATE for WTRA, which has no development date', async () => {
      await expect(parse(SpatialObjectCodeEnum.WTRA, { DEV_DATE: '2026-13-45' })).resolves.toHaveLength(1);
    });

    describe('error message identifies the offending feature', () => {

      it('by NAME when the property is present', async () => {
        await expect(parse(SpatialObjectCodeEnum.CUT_BLOCK, { NAME: "Nature's valley", DEV_DATE: '2026-13-45' }))
          .rejects.toThrow("Property DEV_DATE has an invalid value '2026-13-45' for CUT_BLOCK 'Nature's valley' (feature #1). "
            + "Required format: 'YYYY-MM-DD' (must be a real calendar date).");
      });

      it('by position when NAME is absent', async () => {
        await expect(parse(SpatialObjectCodeEnum.CUT_BLOCK, { DEV_DATE: '2026-13-45' }))
          .rejects.toThrow("Property DEV_DATE has an invalid value '2026-13-45' for CUT_BLOCK feature #1.");
      });

      it('by one based position of the failing feature within the file', async () => {
        const submission = submissionWith(SpatialObjectCodeEnum.CUT_BLOCK, { DEV_DATE: '2023-06-07' });
        const goodFeature = submission.features[0];
        submission.features = [
          goodFeature,
          goodFeature,
          { ...goodFeature, properties: { DEV_DATE: '2026-13-45' } }
        ] as any;

        await expect(service.parseFomSpatialSubmission(SpatialObjectCodeEnum.CUT_BLOCK, submission, user))
          .rejects.toThrow('feature #3');
      });
    });
  });

});
