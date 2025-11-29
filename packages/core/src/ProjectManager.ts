export class ProjectManager {
  private projects: Map<string, any> = new Map();

  async createProject(projectData: any): Promise<string> {
    const projectId = `project_${Date.now()}`;
    this.projects.set(projectId, {
      ...projectData,
      id: projectId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return projectId;
  }

  async saveProject(projectId: string, data: any): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.projects.set(projectId, {
      ...project,
      ...data,
      updatedAt: new Date()
    });
    return true;
  }

  getProject(projectId: string): any {
    return this.projects.get(projectId);
  }

  deleteProject(projectId: string): boolean {
    return this.projects.delete(projectId);
  }
}
