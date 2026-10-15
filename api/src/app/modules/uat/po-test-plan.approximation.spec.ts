/**
 * Automated approximations of the product owner test plan (docs/uat/po-test-plan.md, issue #1135).
 *
 * These tests wire the real ProjectService, MailService, PublicCommentService and ProjectAuthService
 * together and mock only the database repositories, the district/attachment lookups and the mail
 * transporter. They describe current API behaviour; they do not replace the manual run on TEST.
 */
import { MailService } from '@api-core/mail/mail.service';
import { AttachmentTypeEnum } from '@api-modules/attachment/attachment-type-code.entity';
import { ProjectAuthService } from '@api-modules/project/project-auth.service';
import { ProjectCreateRequest, ProjectResponse, ProjectUpdateRequest, ProjectWorkflowStateChangeRequest } from '@api-modules/project/project.dto';
import { Project } from '@api-modules/project/project.entity';
import { ProjectPlanCodeEnum } from '@api-modules/project/project-plan-code.entity';
import { ProjectService } from '@api-modules/project/project.service';
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { PublicCommentAdminUpdateRequest } from '@api-modules/public-comment/public-comment.dto';
import { PublicComment } from '@api-modules/public-comment/public-comment.entity';
import { PublicCommentService } from '@api-modules/public-comment/public-comment.service';
import { ResponseCodeEnum } from '@api-modules/public-comment/response-code.entity';
import { SubmissionTypeCodeEnum } from '@api-modules/submission/submission-type-code.entity';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { User } from '@utility/security/user';
import { mockLoggerFactory } from '../../factories/mock-logger.factory';

const CLIENT_ID = '00001012';
const OTHER_CLIENT_ID = '00009999';
const FOM_ID = 100454;

function bceidUser(clientId = CLIENT_ID): User {
  const user = new User();
  user.userName = 'bceid-tester';
  user.isForestClient = true;
  user.clientIds = [clientId];
  return user;
}

function idirUser(): User {
  const user = new User();
  user.userName = 'idir-reviewer';
  user.isMinistry = true;
  return user;
}

// FOM_ADMIN group only: admin pages, but no FOM_REVIEWER or FOM_SUBMITTER_<client> group.
function adminOnlyUser(): User {
  const user = new User();
  user.userName = 'idir-admin';
  user.isAdmin = true;
  return user;
}

// A "full" IDIR admin holding FOM_ADMIN, FOM_REVIEWER and FOM_SUBMITTER_<client> together.
function fullAdminUser(clientId = CLIENT_ID): User {
  const user = bceidUser(clientId);
  user.userName = 'idir-full-admin';
  user.isMinistry = true;
  user.isAdmin = true;
  return user;
}

function commentClosedFom(overrides: Partial<Project> = {}): Project {
  const fom = new Project();
  Object.assign(fom, {
    id: FOM_ID,
    name: 'UAT FOM',
    revisionCount: 3,
    forestClientId: CLIENT_ID,
    forestClient: { id: CLIENT_ID, name: 'UAT Forest Client Ltd' },
    districtId: 15,
    district: { id: 15, name: 'Cascades Natural Resource District', email: 'FLNR.Cascades' },
    projectPlanCode: ProjectPlanCodeEnum.FSP,
    fspId: 42,
    workflowStateCode: WorkflowStateEnum.COMMENT_CLOSED,
    commentClassificationMandatory: true,
    submissions: [{ submissionTypeCode: SubmissionTypeCodeEnum.PROPOSED }, { submissionTypeCode: SubmissionTypeCodeEnum.FINAL }],
    ...overrides,
  });
  return fom;
}

describe('PO test plan approximations (#1135)', () => {
  const originalEnv = process.env;
  let fom: Project;
  let projectRepository: { findOne: jest.Mock; update: jest.Mock };
  let transporter: { sendMail: jest.Mock };
  let attachmentService: { findByProjectIdAndAttachmentTypes: jest.Mock };
  let publicCommentService: { findByProjectId: jest.Mock };
  let projectService: ProjectService;

  beforeEach(() => {
    process.env = { ...originalEnv, FOM_EMAIL_NOTIFY: 'Heartwood@gov.bc.ca', HOSTNAME: 'fom-test.apps.silver.devops.gov.bc.ca' };
    fom = commentClosedFom();
    projectRepository = {
      findOne: jest.fn().mockImplementation(async () => fom),
      update: jest.fn().mockImplementation(async (_id, partial) => {
        Object.assign(fom, partial);
        return { affected: 1 };
      }),
    };
    transporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'uat' }) };
    attachmentService = { findByProjectIdAndAttachmentTypes: jest.fn().mockResolvedValue([{ id: 1 }]) };
    publicCommentService = { findByProjectId: jest.fn().mockResolvedValue([{ response: { code: ResponseCodeEnum.CONSIDERED } }]) };
    const districtService = { findOne: jest.fn().mockResolvedValue({ id: 15 }) };
    const mailService = new MailService(transporter as any, mockLoggerFactory());
    projectService = new ProjectService(projectRepository as any, mockLoggerFactory(), districtService as any, null,
      attachmentService as any, publicCommentService as any, mailService);
    jest.spyOn(projectService, 'convertEntity').mockReturnValue(new ProjectResponse());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function finalizeRequest(): ProjectWorkflowStateChangeRequest {
    const request = new ProjectWorkflowStateChangeRequest();
    request.revisionCount = fom.revisionCount;
    request.workflowStateCode = WorkflowStateEnum.FINALIZED;
    return request;
  }

  describe('7.1 Finalize state transition', () => {
    it('moves a complete Commenting Closed FOM to Finalized', async () => {
      await projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser());
      expect(projectRepository.update).toHaveBeenCalledWith(FOM_ID, expect.objectContaining({
        workflowStateCode: WorkflowStateEnum.FINALIZED, revisionCount: 4, updateUser: 'bceid-tester',
      }));
      expect(fom.workflowStateCode).toBe(WorkflowStateEnum.FINALIZED);
    });

    it('is blocked unless the FOM is Commenting Closed', async () => {
      fom.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow('Can only finalize if workflow state is Commenting Closed.');
      expect(projectRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('5.7 Finalize validation', () => {
    it('is blocked when classification is mandatory and a comment is unclassified', async () => {
      publicCommentService.findByProjectId.mockResolvedValue([{ response: { code: ResponseCodeEnum.ADDRESSED } }, { response: null }]);
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow(/All comments must be classified/);
      expect(projectRepository.update).not.toHaveBeenCalled();
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it('is allowed with unclassified comments when classification is not mandatory', async () => {
      fom.commentClassificationMandatory = false;
      publicCommentService.findByProjectId.mockResolvedValue([{ response: null }]);
      await projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser());
      expect(fom.workflowStateCode).toBe(WorkflowStateEnum.FINALIZED);
    });

    it('is blocked when there is no final spatial submission', async () => {
      fom.submissions = [{ submissionTypeCode: SubmissionTypeCodeEnum.PROPOSED }] as any;
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow(/Final Submission is required/);
    });

    it('is blocked when there is no spatial submission at all', async () => {
      fom.submissions = [];
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow(/Final Submission is required/);
    });

    it('is blocked when the public notice is missing', async () => {
      attachmentService.findByProjectIdAndAttachmentTypes.mockResolvedValue([]);
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow(/Public Notice is required/);
      expect(attachmentService.findByProjectIdAndAttachmentTypes).toHaveBeenCalledWith(FOM_ID, [AttachmentTypeEnum.PUBLIC_NOTICE]);
    });
  });

  describe('7.2 Finalized notification email', () => {
    it('is sent to the FOM_EMAIL_NOTIFY recipient with an /admin/a/<id> link', async () => {
      await projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser());
      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
      const mail = transporter.sendMail.mock.calls[0][0];
      expect(mail.to).toBe('Heartwood@gov.bc.ca');
      expect(mail.from).toContain('FOMDoNotReply');
      expect(mail.html).toContain(`href="https://fom-test.apps.silver.devops.gov.bc.ca/admin/a/${FOM_ID}"`);
    });

    it('goes to the district address when FOM_EMAIL_NOTIFY is not set', async () => {
      delete process.env.FOM_EMAIL_NOTIFY;
      await projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser());
      expect(transporter.sendMail.mock.calls[0][0].to).toBe('FLNR.Cascades@gov.bc.ca');
    });

    it('reports an error when sending fails, after the FOM is already Finalized', async () => {
      transporter.sendMail.mockRejectedValue(new Error('TLS failure'));
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser()))
        .rejects.toThrow(InternalServerErrorException);
      expect(fom.workflowStateCode).toBe(WorkflowStateEnum.FINALIZED);
    });
  });

  describe('5.2 Comment responses', () => {
    let comment: PublicComment;
    let commentRepository: { findOne: jest.Mock; update: jest.Mock };
    let commentService: PublicCommentService;

    beforeEach(() => {
      comment = Object.assign(new PublicComment(), { id: 7, projectId: FOM_ID, revisionCount: 0 });
      commentRepository = {
        findOne: jest.fn().mockResolvedValue(comment),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const projectAuthService = new ProjectAuthService(projectRepository as any);
      commentService = new PublicCommentService(commentRepository as any, mockLoggerFactory(), projectAuthService);
      jest.spyOn(commentService as any, 'findEntityWithCommonRelations').mockResolvedValue(comment);
      jest.spyOn(commentService as any, 'convertEntity').mockReturnValue({} as any);
    });

    function responseRequest(): PublicCommentAdminUpdateRequest {
      return { revisionCount: 0, responseCode: ResponseCodeEnum.CONSIDERED, responseDetails: 'Noted' };
    }

    it('saves a response from the FOM holder once commenting is closed', async () => {
      fom.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      await commentService.update(7, responseRequest(), bceidUser());
      expect(commentRepository.update).toHaveBeenCalledWith(7, expect.objectContaining({
        responseCode: ResponseCodeEnum.CONSIDERED, revisionCount: 1,
      }));
    });

    // Holders can classify and respond while commenting is still open. The admin UI allows this too
    // (review-comments.component.ts canReplyComment: COMMENT_OPEN or COMMENT_CLOSED).
    it('saves a response from the FOM holder while commenting is open', async () => {
      fom.workflowStateCode = WorkflowStateEnum.COMMENT_OPEN;
      await commentService.update(7, responseRequest(), bceidUser());
      expect(commentRepository.update).toHaveBeenCalled();
    });

    it('rejects a response after the FOM is Finalized', async () => {
      fom.workflowStateCode = WorkflowStateEnum.FINALIZED;
      await expect(commentService.update(7, responseRequest(), bceidUser())).rejects.toThrow(ForbiddenException);
    });

    it('rejects a response from a ministry (IDIR) user', async () => {
      await expect(commentService.update(7, responseRequest(), idirUser())).rejects.toThrow(ForbiddenException);
    });

    it('rejects a response from an admin-only IDIR user', async () => {
      await expect(commentService.update(7, responseRequest(), adminOnlyUser())).rejects.toThrow(ForbiddenException);
    });

    it('accepts a response from a full IDIR admin who also holds the submitter role for the client', async () => {
      await commentService.update(7, responseRequest(), fullAdminUser());
      expect(commentRepository.update).toHaveBeenCalled();
    });

    it('rejects a response from a BCeID user for another client', async () => {
      await expect(commentService.update(7, responseRequest(), bceidUser(OTHER_CLIENT_ID))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2 Role guards: reviewer vs admin vs full admin', () => {
    const create = () => Object.assign(new ProjectCreateRequest(), { forestClientNumber: CLIENT_ID });

    it('admin-only IDIR users cannot create, edit or finalize', async () => {
      expect(await projectService.isCreateAuthorized(create(), adminOnlyUser())).toBe(false);
      fom.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await projectService.isUpdateAuthorized(new ProjectUpdateRequest(), fom, adminOnlyUser())).toBe(false);
      fom.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), adminOnlyUser())).rejects.toThrow(ForbiddenException);
    });

    it('full IDIR admins with the submitter role can create, edit and finalize for that client', async () => {
      expect(await projectService.isCreateAuthorized(create(), fullAdminUser())).toBe(true);
      fom.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await projectService.isUpdateAuthorized(new ProjectUpdateRequest(), fom, fullAdminUser())).toBe(true);
      fom.workflowStateCode = WorkflowStateEnum.COMMENT_CLOSED;
      await projectService.workflowStateChange(FOM_ID, finalizeRequest(), fullAdminUser());
      expect(fom.workflowStateCode).toBe(WorkflowStateEnum.FINALIZED);
    });

    it('full IDIR admins are still limited to the clients in their submitter roles', async () => {
      expect(await projectService.isCreateAuthorized(create(), fullAdminUser(OTHER_CLIENT_ID))).toBe(false);
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), fullAdminUser(OTHER_CLIENT_ID))).rejects.toThrow(ForbiddenException);
    });

    it('only reviewer (ministry) users can change classification mandatory; BCeID users cannot', async () => {
      const request = { revisionCount: fom.revisionCount, commentClassificationMandatory: false } as any;
      await expect(projectService.commentClassificationMandatoryChange(FOM_ID, request, bceidUser())).rejects.toThrow(ForbiddenException);
      await expect(projectService.commentClassificationMandatoryChange(FOM_ID, request, adminOnlyUser())).rejects.toThrow(ForbiddenException);
      await projectService.commentClassificationMandatoryChange(FOM_ID, request, idirUser());
      expect(projectRepository.update).toHaveBeenCalledWith(FOM_ID, expect.objectContaining({ commentClassificationMandatory: false }));
    });
  });

  describe('2 Role guards', () => {
    it('ministry users cannot create a FOM', async () => {
      const request = new ProjectCreateRequest();
      request.forestClientNumber = CLIENT_ID;
      expect(await projectService.isCreateAuthorized(request, idirUser())).toBe(false);
    });

    it('BCeID users can create only for their own client', async () => {
      const request = new ProjectCreateRequest();
      request.forestClientNumber = CLIENT_ID;
      expect(await projectService.isCreateAuthorized(request, bceidUser())).toBe(true);
      expect(await projectService.isCreateAuthorized(request, bceidUser(OTHER_CLIENT_ID))).toBe(false);
    });

    it('ministry users cannot edit a FOM', async () => {
      fom.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await projectService.isUpdateAuthorized(new ProjectUpdateRequest(), fom, idirUser())).toBe(false);
    });

    it('BCeID users can edit only their own client\'s FOM', async () => {
      fom.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await projectService.isUpdateAuthorized(new ProjectUpdateRequest(), fom, bceidUser())).toBe(true);
      expect(await projectService.isUpdateAuthorized(new ProjectUpdateRequest(), fom, bceidUser(OTHER_CLIENT_ID))).toBe(false);
    });

    it('ministry users cannot finalize', async () => {
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), idirUser())).rejects.toThrow(ForbiddenException);
    });

    it('BCeID users cannot finalize another client\'s FOM', async () => {
      await expect(projectService.workflowStateChange(FOM_ID, finalizeRequest(), bceidUser(OTHER_CLIENT_ID)))
        .rejects.toThrow(ForbiddenException);
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it('BCeID users cannot see another client\'s unpublished FOM', async () => {
      fom.workflowStateCode = WorkflowStateEnum.INITIAL;
      expect(await projectService.isViewAuthorized(fom, bceidUser())).toBe(true);
      expect(await projectService.isViewAuthorized(fom, bceidUser(OTHER_CLIENT_ID))).toBe(false);
    });
  });
});
