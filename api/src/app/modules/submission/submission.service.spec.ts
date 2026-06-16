import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { SubmissionService } from './submission.service';
import { FomSpatialJson, SpatialCoordSystemEnum } from './submission.dto';
import { Geometry } from 'geojson';

describe('SubmissionService', () => {
  let service: SubmissionService;

  beforeEach(async () => {
    service = new SubmissionService(null as never, mockLoggerFactory(), null as never, null as never);
  });

  describe('detectSpatialSubmissionCoordRef', () => {
    let simpleOneFeatureSpatialSubmission: FomSpatialJson;
    const geometry_BCAlbers = {"type":"Polygon","coordinates":[[[1474614.5923999995,555392.2415999994],[1474537.8630999997,555275.8246999998],[1474588.1340999994,555146.1786000002],[1474723.071799999,555080.0326000005],[1474818.3220000006,555138.2411000002],[1474902.9889000002,555220.2620999999],[1474818.3220000006,555334.0330999997],[1474701.9050999992,555437.2207999993],[1474614.5923999995,555392.2415999994]]]};
    const geometry_WGS84 = {"type":"Polygon","coordinates":[[[-119.397280854,49.815298833],[-119.394459294,49.815127941],[-119.394863101,49.812334408],[-119.39768449,49.812505292],[-119.397280854,49.815298833]]]};

    beforeEach(async () => {
      simpleOneFeatureSpatialSubmission  = {"type":"FeatureCollection", "features":[{"type":"Feature","geometry":null,"properties":{"DEVELOPMENT_DATE":"2022-03-30","NAME":"Nature's valley"}}]} as unknown as FomSpatialJson;
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

});
