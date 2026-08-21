import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { ProjectPlanCodeEnum } from '@src/app/modules/project/project-plan-code.entity';
import { validate } from 'class-validator';
import { ProjectCreateRequest, ProjectUpdateRequest } from './project.dto';
import { PublicNoticeCreateRequest } from './public-notice.dto';

describe('Project & Public Notice DTO Validations', () => {
  const currentYear = DateTimeUtil.now(DateTimeUtil.TIMEZONE_VANCOUVER).year();

  function createValidProjectRequest(): ProjectCreateRequest {
    const dto = new ProjectCreateRequest();
    dto.name = 'Valid FOM Project Name';
    dto.description = 'Valid description for the project';
    dto.forestClientNumber = '00012345';
    dto.projectPlanCode = ProjectPlanCodeEnum.FSP;
    dto.fspId = 1234;
    dto.districtId = 15;
    dto.operationStartYear = currentYear;
    dto.operationEndYear = currentYear + 3;
    return dto;
  }

  describe('ProjectCreateRequest', () => {
    it('validates a correct ProjectCreateRequest payload', async () => {
      const dto = createValidProjectRequest();
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects names shorter than 5 characters', async () => {
      const dto = createValidProjectRequest();
      dto.name = 'ABC';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('rejects missing or empty name', async () => {
      const dto = createValidProjectRequest();
      dto.name = undefined as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'name')).toBe(true);
    });

    it('requires fspId when projectPlanCode is FSP and ignores woodlotLicenseNumber', async () => {
      const dto = createValidProjectRequest();
      dto.projectPlanCode = ProjectPlanCodeEnum.FSP;
      dto.fspId = undefined;
      dto.woodlotLicenseNumber = undefined;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'fspId')).toBe(true);
      expect(errors.some(e => e.property === 'woodlotLicenseNumber')).toBe(false);

      dto.fspId = 1234;
      const validErrors = await validate(dto);
      expect(validErrors.some(e => e.property === 'fspId')).toBe(false);
    });

    it('requires woodlotLicenseNumber matching W#### when projectPlanCode is WOODLOT and ignores fspId', async () => {
      const dto = createValidProjectRequest();
      dto.projectPlanCode = ProjectPlanCodeEnum.WOODLOT;
      dto.fspId = undefined;
      dto.woodlotLicenseNumber = undefined;

      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'woodlotLicenseNumber')).toBe(true);
      expect(errors.some(e => e.property === 'fspId')).toBe(false);

      // Invalid format
      dto.woodlotLicenseNumber = '1234';
      const invalidErrors = await validate(dto);
      expect(invalidErrors.some(e => e.property === 'woodlotLicenseNumber')).toBe(true);

      // Valid format
      dto.woodlotLicenseNumber = 'W1234';
      const validErrors = await validate(dto);
      expect(validErrors.some(e => e.property === 'woodlotLicenseNumber')).toBe(false);
      expect(validErrors.some(e => e.property === 'fspId')).toBe(false);
    });

    it('rejects invalid projectPlanCode values', async () => {
      const dto = createValidProjectRequest();
      dto.projectPlanCode = 'INVALID_PLAN' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'projectPlanCode')).toBe(true);
    });

    it('rejects operationEndYear prior to operationStartYear', async () => {
      const dto = createValidProjectRequest();
      dto.operationStartYear = currentYear + 2;
      dto.operationEndYear = currentYear + 1;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'operationEndYear')).toBe(true);
    });
  });

  describe('ProjectUpdateRequest', () => {
    it('requires revisionCount on update requests', async () => {
      const dto = new ProjectUpdateRequest();
      dto.name = 'Updated Project Name';
      // revisionCount omitted

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'revisionCount')).toBe(true);

      dto.revisionCount = 2;
      const validErrors = await validate(dto);
      expect(validErrors.some(e => e.property === 'revisionCount')).toBe(false);
    });
  });

  describe('PublicNoticeCreateRequest', () => {
    it('validates a valid PublicNoticeCreateRequest', async () => {
      const dto = new PublicNoticeCreateRequest();
      dto.projectId = 100;
      dto.reviewAddress = '100 Main St, Victoria BC';
      dto.reviewBusinessHours = '8:30am - 4:30pm Mon-Fri';
      dto.isReceiveCommentsSameAsReview = true;
      dto.mailingAddress = 'PO Box 1234, Victoria BC';
      dto.email = 'forest.client@gov.bc.ca';
      dto.postDate = '2026-09-01';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects invalid postDate format', async () => {
      const dto = new PublicNoticeCreateRequest();
      dto.projectId = 100;
      dto.reviewAddress = '100 Main St';
      dto.reviewBusinessHours = '8:30am - 4:30pm';
      dto.isReceiveCommentsSameAsReview = true;
      dto.mailingAddress = 'PO Box 1234';
      dto.email = 'test@example.com';
      dto.postDate = '01/09/2026'; // invalid non-ISO format

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'postDate')).toBe(true);
    });
  });
});
