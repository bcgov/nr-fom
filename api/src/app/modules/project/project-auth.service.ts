import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from "@utility/security/user";
import { FindOneOptions, Repository } from 'typeorm';
import { Project } from './project.entity';
import { WorkflowStateEnum } from './workflow-state-code.entity';

/**
 * Performs authorization checks for a user against a project using standard permissions:
 * Ministry user: full read access to all projects, no write access
 * Forest-client user: full read/write access to projects they are authorized for based on client id.
 * Public (non-authenticated) user: no access.
 * 
 */
@Injectable()
export class ProjectAuthService { 
  constructor(
    @InjectRepository(Project)
    private repository: Repository<Project>,
  ) {
  }

  /**
   * Return whether the specified user is a forest client user with access to this project based on forest client id.
   * @param projectId 
   * @param user 
   */
   async isForestClientUserAccess(projectId: number, user?: User): Promise<boolean> {

    if (!user?.isForestClient) {
      return false;
    }

    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }

    return user.isAuthorizedForClientId(project.forestClientId);
  }

  /**
   * Return whether the specified user is a forest client user with access to this project based on forest client id and allowed workflow states.
   * @param projectId 
   * @param user 
   */
  async isForestClientUserAllowedStateAccess(projectId: number, allowedWorkflowStates: WorkflowStateEnum[], user?: User): Promise<boolean> {

    if (!user?.isForestClient) {
      return false;
    }

    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }

    if (! user.isAuthorizedForClientId(project.forestClientId)) {
      return false;
    }

    return this.isAllowedWorkflowState(project, allowedWorkflowStates);
  }

  /**
   * Return whether the specified user is a forest client user with access to this project based on forest client id and allowed workflow states.
   * @param projectId 
   * @param user 
   */
   async isAnonymousUserAllowedStateAccess(projectId: number, allowedWorkflowStates: WorkflowStateEnum[], user?: User): Promise<boolean> {
    if (user) {
      return false;
    }

    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }

    return this.isAllowedWorkflowState(project, allowedWorkflowStates);
  }

  /**
   * Return whether the specified ministry user has access to this project based on allowed workflow states.
   */
  async isMinistryAllowedStateAccess(projectId: number, allowedWorkflowStates: WorkflowStateEnum[], user?: User): Promise<boolean> {
    if (!user?.isMinistry) return false;
    const project = await this.getProject(projectId);
    if (!project) return false;
    return this.isAllowedWorkflowState(project, allowedWorkflowStates);
  }

  private isAllowedWorkflowState(project: Project, allowedWorkflowStates: WorkflowStateEnum[]): boolean {
    return allowedWorkflowStates.includes(project.workflowStateCode as WorkflowStateEnum);
  }

  private async getProject(projectId: number): Promise<Project> {
    return this.repository.findOne({ where: { id: projectId } } as FindOneOptions);
  }

}
