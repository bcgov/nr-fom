import { mockLoggerFactory } from '../../factories/mock-logger.factory';
import { SubmissionService } from './submission.service';
import { FomSpatialJson, SpatialCoordSystemEnum, SpatialObjectCodeEnum } from './submission.dto';
import { Geometry } from 'geojson';
import { User } from '@utility/security/user';
import { CutBlock } from './cut-block.entity';
import { RoadSection } from './road-section.entity';
import { RetentionArea } from './retention-area.entity';
import { WorkflowStateEnum } from '../project/workflow-state-code.entity';
import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { SubmissionTypeCodeEnum } from './submission-type-code.entity';

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

    // Every date is derived from today rather than hardcoded. A literal date would satisfy the
    // format rule forever but silently drift out of the business range as the suite ages, and a
    // literal month/day would break on the one day of the year it happens to equal.
    const DATE_FORMAT = DateTimeUtil.DATE_FORMAT;
    const today = () => DateTimeUtil.nowBC().startOf('day');
    const dateIn = (amount: number, unit: 'day' | 'year') => today().add(amount, unit).format(DATE_FORMAT);
    // Comfortably inside the accepted range, for cases that are about something other than the range.
    const inRangeDate = () => dateIn(1, 'year');

    const isLeapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    // Search forward from next year so the result is always in the future, and within the 7 year
    // ceiling: a leap year occurs at least every 4 years and a non leap year at least every year.
    const yearAfterNext = (leap: boolean) => {
      let year = today().year() + 1;
      while (isLeapYear(year) !== leap) { year++; }
      return year;
    };

    // Both spatial object types share the same DEV_DATE rules, so each case runs against both.
    const dateRequiredTypes = [SpatialObjectCodeEnum.CUT_BLOCK, SpatialObjectCodeEnum.ROAD_SECTION];

    describe.each(dateRequiredTypes)('%s', (spatialObjectCode) => {

      it.each([
        ['DEV_DATE in the required format', () => ({ DEV_DATE: inRangeDate() })],
        ['legacy DEVELOPMENT_DATE property', () => ({ DEVELOPMENT_DATE: inRangeDate() })],
        ['Feb 29 of a leap year', () => ({ DEV_DATE: `${yearAfterNext(true)}-02-29` })],
      ])('accepts %s', async (_label, properties) => {
        await expect(parse(spatialObjectCode, properties())).resolves.toHaveLength(1);
      });

      it.each([
        // Previously accepted by the lenient parse and silently coerced. '2026-13-45' was the
        // worst case: it rolled forward and was stored as 2027-02-14.
        ['month and day out of range', () => ({ DEV_DATE: '2026-13-45' })],
        ['a day that does not exist in the month', () => ({ DEV_DATE: '2026-02-30' })],
        // A future non leap year, so this fails on the format rule alone and not on the date range.
        ['Feb 29 of a non leap year', () => ({ DEV_DATE: `${yearAfterNext(false)}-02-29` })],
        ['slash separators', () => ({ DEV_DATE: '2023/06/07' })],
        ['a full ISO timestamp', () => ({ DEV_DATE: '2026-08-11T10:00:00Z' })],
        // Rejected before the strict change as well, kept to pin the whole accepted set.
        ['no separators', () => ({ DEV_DATE: '20230607' })],
        ['day and month transposed', () => ({ DEV_DATE: '06-07-2023' })],
        ['unpadded month and day', () => ({ DEV_DATE: '2026-8-11' })],
        ['an empty value', () => ({ DEV_DATE: '' })],
        ['a null value', () => ({ DEV_DATE: null })],
      ])('rejects %s', async (_label, properties) => {
        await expect(parse(spatialObjectCode, properties())).rejects.toThrow(/DEV_DATE has an invalid value/);
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
      const devDate = inRangeDate();
      const [cutBlock] = await parse(SpatialObjectCodeEnum.CUT_BLOCK, { NAME: 'Block A', DEV_DATE: devDate });
      expect((cutBlock as CutBlock).plannedDevelopmentDate).toBe(devDate);
    });

    it('keeps a valid legacy DEVELOPMENT_DATE on the parsed road section', async () => {
      const devDate = inRangeDate();
      const [roadSection] = await parse(SpatialObjectCodeEnum.ROAD_SECTION, { DEVELOPMENT_DATE: devDate });
      expect((roadSection as RoadSection).plannedDevelopmentDate).toBe(devDate);
    });

    it('does not require DEV_DATE for WTRA', async () => {
      await expect(parse(SpatialObjectCodeEnum.WTRA, { NAME: 'Retention 1' })).resolves.toHaveLength(1);
    });

    it('ignores an invalid DEV_DATE for WTRA, which has no development date', async () => {
      await expect(parse(SpatialObjectCodeEnum.WTRA, { DEV_DATE: '2026-13-45' })).resolves.toHaveLength(1);
    });

    it('reports the format problem, not the range problem, when a value is both', async () => {
      // '2026-13-45' is unparseable and would also be out of range once coerced. Parsing fails
      // first, so the range check never sees it and the submitter is not told to adjust a date
      // that was never readable.
      await expect(parse(SpatialObjectCodeEnum.CUT_BLOCK, { DEV_DATE: '2026-13-45' }))
        .rejects.toThrow(/has an invalid value/);
    });

    /**
     * The business range rule, applied to already parsed spatial objects. The lower bound comes from
     * getEarliestAllowedDevelopmentDate, stubbed here so these cases are about the comparison only;
     * choosing the bound is covered separately below.
     */
    describe('development date business range', () => {
      const PROJECT_ID = 42;

      const parsedObject = (spatialObjectCode: SpatialObjectCodeEnum, plannedDevelopmentDate: string, name?: string) =>
        spatialObjectCode === SpatialObjectCodeEnum.ROAD_SECTION
          ? new RoadSection({ name, plannedDevelopmentDate })
          : new CutBlock({ name, plannedDevelopmentDate });

      const validateRange = (spatialObjectCode: SpatialObjectCodeEnum, developmentDates: string[],
        options: { earliestAllowed?: string, names?: string[] } = {}) => {
        jest.spyOn(service as any, 'getEarliestAllowedDevelopmentDate')
          .mockResolvedValue(options.earliestAllowed ?? today().format(DATE_FORMAT));
        const spatialObjects = developmentDates.map((developmentDate, i) =>
          parsedObject(spatialObjectCode, developmentDate, options.names?.[i]));
        return (service as any).validateDevelopmentDateRanges(
          spatialObjects, PROJECT_ID, SubmissionTypeCodeEnum.FINAL, spatialObjectCode);
      };

      describe.each(dateRequiredTypes)('%s', (spatialObjectCode) => {

        it.each([
          ['today', () => today().format(DATE_FORMAT)],
          ['tomorrow', () => dateIn(1, 'day')],
          ['a date part way through the range', () => dateIn(3, 'year')],
          // The ceiling is a year, not a date, so December 31 of the last permitted year is valid.
          ['the last day of the final permitted year', () => `${today().year() + 7}-12-31`],
        ])('accepts %s', async (_label, developmentDate) => {
          await expect(validateRange(spatialObjectCode, [developmentDate()])).resolves.toBeUndefined();
        });

        it.each([
          ['yesterday', () => dateIn(-1, 'day')],
          ['a date several years in the past', () => dateIn(-5, 'year')],
        ])('rejects %s as being in the past', async (_label, developmentDate) => {
          await expect(validateRange(spatialObjectCode, [developmentDate()]))
            .rejects.toThrow(/is in the past\. It must be on or after /);
        });

        it.each([
          ['the first day of the year after the ceiling', () => `${today().year() + 8}-01-01`],
          ['a date far beyond the ceiling', () => dateIn(20, 'year')],
        ])('rejects %s as being too far in the future', async (_label, developmentDate) => {
          await expect(validateRange(spatialObjectCode, [developmentDate()]))
            .rejects.toThrow(/is too far in the future\. It must be no later than the end of /);
        });
      });

      it('does not look at retention areas, which carry no development date', async () => {
        const getBound = jest.spyOn(service as any, 'getEarliestAllowedDevelopmentDate');
        await expect((service as any).validateDevelopmentDateRanges(
          [new RetentionArea({})], PROJECT_ID, SubmissionTypeCodeEnum.FINAL, SpatialObjectCodeEnum.WTRA))
          .resolves.toBeUndefined();
        expect(getBound).not.toHaveBeenCalled();
      });

      describe('with a bound earlier than today, as a FINAL submission gets', () => {
        const earliestAllowed = () => dateIn(-30, 'day');

        it('accepts a past date on the bound', async () => {
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [earliestAllowed()],
            { earliestAllowed: earliestAllowed() })).resolves.toBeUndefined();
        });

        it('accepts a past date after the bound but still before today', async () => {
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [dateIn(-10, 'day')],
            { earliestAllowed: earliestAllowed() })).resolves.toBeUndefined();
        });

        it('rejects a date before the bound', async () => {
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [dateIn(-31, 'day')],
            { earliestAllowed: earliestAllowed() }))
            .rejects.toThrow(`is in the past. It must be on or after ${earliestAllowed()}.`);
        });

        it('still applies the future ceiling relative to today, not to the bound', async () => {
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [`${today().year() + 8}-01-01`],
            { earliestAllowed: earliestAllowed() })).rejects.toThrow(/is too far in the future/);
        });
      });

      describe('error message identifies the offending object', () => {

        it('by NAME and the lower bound', async () => {
          const pastDate = dateIn(-1, 'day');
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [pastDate], { names: ['Block A'] }))
            .rejects.toThrow(`Property DEV_DATE '${pastDate}' for CUT_BLOCK 'Block A' (feature #1) is in the past. `
              + `It must be on or after ${today().format(DATE_FORMAT)}.`);
        });

        it('by NAME and the ceiling year', async () => {
          const farDate = `${today().year() + 8}-01-01`;
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [farDate], { names: ['Block A'] }))
            .rejects.toThrow(`Property DEV_DATE '${farDate}' for CUT_BLOCK 'Block A' (feature #1) is too far in the future. `
              + `It must be no later than the end of ${today().year() + 7}.`);
        });

        it('by position when NAME is absent', async () => {
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, [dateIn(-1, 'day')]))
            .rejects.toThrow(/for CUT_BLOCK feature #1 is in the past/);
        });

        it('by one based position of the failing object, which follows submission file order', async () => {
          const dates = [inRangeDate(), inRangeDate(), dateIn(-1, 'day')];
          await expect(validateRange(SpatialObjectCodeEnum.CUT_BLOCK, dates)).rejects.toThrow('feature #3');
        });
      });
    });

    /**
     * The range rule lives outside the parse chain, so this pins that processSpatialSubmission
     * actually invokes it. Without this, deleting the call would break no other test.
     */
    it('validates the development date range as part of processing a submission', async () => {
      const repository: any = {
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation(async (entity) => ({ ...entity, id: 7 }))
      };
      const projectService: any = {
        findOne: jest.fn().mockResolvedValue({ id: 42, workflowState: { code: WorkflowStateEnum.INITIAL } })
      };
      const projectAuthService: any = { isForestClientUserAllowedStateAccess: jest.fn().mockResolvedValue(true) };
      const svc = new SubmissionService(repository, mockLoggerFactory(), projectService, projectAuthService);

      const parsed = [new CutBlock({ name: 'Block A', plannedDevelopmentDate: inRangeDate() })];
      jest.spyOn(svc, 'prepareFomSpatialObjects').mockResolvedValue(parsed);
      // Short circuit before the DB-backed steps that follow.
      const rangeCheck = jest.spyOn(svc as any, 'validateDevelopmentDateRanges')
        .mockRejectedValue(new Error('STOP-AFTER-RANGE-CHECK'));

      await expect(svc.processSpatialSubmission({
        projectId: 42,
        submissionTypeCode: SubmissionTypeCodeEnum.PROPOSED,
        spatialObjectCode: SpatialObjectCodeEnum.CUT_BLOCK,
        jsonSpatialSubmission: {} as any
      }, user)).rejects.toThrow('STOP-AFTER-RANGE-CHECK');

      expect(rangeCheck).toHaveBeenCalledWith(parsed, 42, SubmissionTypeCodeEnum.PROPOSED, SpatialObjectCodeEnum.CUT_BLOCK);
    });

    /**
     * Selection of that bound. Exercised directly because it is the branch that decides whether a
     * FINAL submission gets the relaxed bound at all.
     */
    describe('choosing the earliest allowed date', () => {
      const PROJECT_ID = 42;
      const PROPOSED_SUBMISSION_ID = 7;

      // Late evening in BC is already the next day in UTC. The bound must report the BC day.
      // Note this only discriminates when the test process is not itself on Vancouver time: on a
      // Pacific machine reading the timestamp in server-local time gives the same answer. It does
      // catch the bug where it matters, since the containers and CI run UTC.
      const proposedCreateTimestamp = new Date('2026-01-10T03:00:00Z'); // 2026-01-09 19:00 in BC
      const proposedCreateBcDate = '2026-01-09';

      const serviceWith = (proposedSubmission: any, spatialCounts: any) => {
        const repository: any = { find: jest.fn().mockResolvedValue(proposedSubmission ? [proposedSubmission] : []) };
        const svc = new SubmissionService(repository, mockLoggerFactory(), null, null);
        jest.spyOn(svc as any, 'getDataSource').mockReturnValue({
          query: jest.fn().mockResolvedValue([spatialCounts])
        });
        return svc;
      };

      const earliestAllowedFor = (svc: SubmissionService, submissionTypeCode: SubmissionTypeCodeEnum,
        spatialObjectCode = SpatialObjectCodeEnum.CUT_BLOCK) =>
        (svc as any).getEarliestAllowedDevelopmentDate(PROJECT_ID, submissionTypeCode, spatialObjectCode);

      const proposedSubmission = { id: PROPOSED_SUBMISSION_ID, createTimestamp: proposedCreateTimestamp };
      const todayString = () => today().format(DATE_FORMAT);

      it('is today for a PROPOSED submission, without looking up anything', async () => {
        const svc = serviceWith(proposedSubmission, { cbcount: '5' });
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.PROPOSED)).toBe(todayString());
        expect((svc as any).getDataSource).not.toHaveBeenCalled();
      });

      it('is the PROPOSED submission create date for a FINAL submission of the same type', async () => {
        const svc = serviceWith(proposedSubmission, { cbcount: '5', rscount: '0', racount: '0' });
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.FINAL)).toBe(proposedCreateBcDate);
      });

      it('is today for a FINAL submission when there is no PROPOSED submission', async () => {
        const svc = serviceWith(null, { cbcount: '0' });
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.FINAL)).toBe(todayString());
      });

      it('is today for a FINAL submission of a type the PROPOSED submission did not contain', async () => {
        // PROPOSED had cut blocks only; road sections are new at FINAL so nothing needs preserving.
        const svc = serviceWith(proposedSubmission, { cbcount: '5', rscount: '0', racount: '0' });
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.FINAL, SpatialObjectCodeEnum.ROAD_SECTION))
          .toBe(todayString());
      });

      it('reads the count for the spatial type actually being submitted', async () => {
        const svc = serviceWith(proposedSubmission, { cbcount: '0', rscount: '3', racount: '0' });
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.FINAL, SpatialObjectCodeEnum.ROAD_SECTION))
          .toBe(proposedCreateBcDate);
        expect(await earliestAllowedFor(svc, SubmissionTypeCodeEnum.FINAL, SpatialObjectCodeEnum.CUT_BLOCK))
          .toBe(todayString());
      });
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
        const submission = submissionWith(SpatialObjectCodeEnum.CUT_BLOCK, { DEV_DATE: inRangeDate() });
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
