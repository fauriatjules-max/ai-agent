import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from '../core/workflow/workflow.service';
import { WorkflowExecutor } from '../core/workflow/workflow.executor';
import { EventBus } from '../core/event-bus/event.bus';
import { Logger } from '../utils/logger';
import { validateWorkflow, validateWorkflowUpdate } from '../api/validators/workflow.validator';
import { DatabaseService } from '../database/database.service';
import { AuthenticationService } from '../auth/auth.service';
import { JsonFunctions } from '../json/src/json.functions';

export class WorkflowController {
  private workflowService: WorkflowService;
  private workflowExecutor: WorkflowExecutor;
  private logger: Logger;
  private authService: AuthenticationService;
  private jsonFunctions: JsonFunctions;

  constructor() {
    this.logger = new Logger('WorkflowController');
    const dbService = new DatabaseService();
    const eventBus = new EventBus();
    
    this.workflowService = new WorkflowService(dbService);
    this.workflowExecutor = new WorkflowExecutor(this.workflowService, eventBus);
    this.authService = new AuthenticationService();
    this.jsonFunctions = new JsonFunctions();
  }

  /**
   * Get all workflows with pagination and filtering
   */
  async getWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        search,
        type,
        active,
        userId,
        tags
      } = req.query;

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        search: search as string,
        type: type as string,
        active: active !== undefined ? active === 'true' : undefined,
        userId: userId as string,
        tags: tags ? (tags as string).split(',') : []
      };

      const result = await this.workflowService.getWorkflows(options);
      
      res.json({
        success: true,
        data: result.workflows,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        },
        filters: options
      });
    } catch (error: any) {
      this.logger.error('Failed to get workflows', error);
      next(error);
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflowById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { includeNodes = true, includeStats = false, includeExecutions = false } = req.query;

      const workflow = await this.workflowService.getWorkflowById(id, {
        includeNodes: includeNodes === 'true',
        includeStats: includeStats === 'true',
        includeExecutions: includeExecutions === 'true'
      });

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        data: workflow
      });
    } catch (error: any) {
      this.logger.error(`Failed to get workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Create new workflow
   */
  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workflowData = req.body;
      const userId = this.getUserId(req);

      // Validate workflow data
      const validation = validateWorkflow(workflowData);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid workflow data',
          details: validation.errors
        });
        return;
      }

      // Add user ID and timestamps
      const workflow = {
        ...workflowData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        active: workflowData.active !== undefined ? workflowData.active : false
      };

      const createdWorkflow = await this.workflowService.createWorkflow(workflow);

      // Emit workflow created event
      this.workflowService.emitEvent('workflow:created', {
        workflowId: createdWorkflow.id,
        userId,
        timestamp: new Date()
      });

      res.status(201).json({
        success: true,
        data: createdWorkflow,
        message: 'Workflow created successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to create workflow', error);
      next(error);
    }
  }

  /**
   * Update workflow
   */
  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = this.getUserId(req);

      // Validate update data
      const validation = validateWorkflowUpdate(updateData);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid workflow update data',
          details: validation.errors
        });
        return;
      }

      // Check if workflow exists and user has permission
      const existingWorkflow = await this.workflowService.getWorkflowById(id);
      if (!existingWorkflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (!this.hasWorkflowPermission(existingWorkflow, userId, 'write')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to update this workflow'
        });
        return;
      }

      // Prepare update data
      const update = {
        ...updateData,
        updatedAt: new Date(),
        version: existingWorkflow.version + 1
      };

      // Handle versioning - save previous version
      if (update.nodes || update.connections || update.settings) {
        await this.workflowService.saveWorkflowVersion(existingWorkflow);
      }

      const updatedWorkflow = await this.workflowService.updateWorkflow(id, update);

      // Emit workflow updated event
      this.workflowService.emitEvent('workflow:updated', {
        workflowId: id,
        userId,
        timestamp: new Date(),
        changes: Object.keys(updateData)
      });

      res.json({
        success: true,
        data: updatedWorkflow,
        message: 'Workflow updated successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to update workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);

      // Check if workflow exists and user has permission
      const existingWorkflow = await this.workflowService.getWorkflowById(id);
      if (!existingWorkflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (!this.hasWorkflowPermission(existingWorkflow, userId, 'delete')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this workflow'
        });
        return;
      }

      // Soft delete or hard delete based on query param
      const permanent = req.query.permanent === 'true';
      
      if (permanent) {
        await this.workflowService.deleteWorkflowPermanently(id);
      } else {
        await this.workflowService.deleteWorkflow(id);
      }

      // Emit workflow deleted event
      this.workflowService.emitEvent('workflow:deleted', {
        workflowId: id,
        userId,
        permanent,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: permanent ? 'Workflow permanently deleted' : 'Workflow moved to trash'
      });
    } catch (error: any) {
      this.logger.error(`Failed to delete workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const {
        data = {},
        nodeId,
        mode = 'sync',
        saveExecution = true,
        timeout = 30000,
        webhookResponse = false
      } = req.body;

      const userId = this.getUserId(req);

      // Check if workflow exists and is active
      const workflow = await this.workflowService.getWorkflowById(id);
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (!workflow.active && !webhookResponse) {
        res.status(400).json({
          success: false,
          error: 'Workflow is not active'
        });
        return;
      }

      // Prepare execution options
      const executionOptions = {
        workflowId: id,
        inputData: data,
        nodeId,
        userId,
        saveExecution,
        timeout: parseInt(timeout as any),
        mode: mode as 'sync' | 'async',
        webhookResponse
      };

      // Execute workflow
      let executionResult;
      
      if (mode === 'async') {
        // Start async execution and return immediately
        executionResult = await this.workflowExecutor.executeAsync(executionOptions);
        
        res.json({
          success: true,
          data: {
            executionId: executionResult.executionId,
            status: 'queued',
            message: 'Workflow execution started asynchronously',
            webhook: executionResult.webhookUrl
          }
        });
      } else {
        // Execute synchronously
        executionResult = await this.workflowExecutor.execute(executionOptions);
        
        res.json({
          success: executionResult.success,
          data: executionResult.data,
          execution: {
            id: executionResult.executionId,
            status: executionResult.status,
            duration: executionResult.duration,
            startedAt: executionResult.startedAt,
            finishedAt: executionResult.finishedAt
          },
          metadata: {
            workflowId: id,
            nodeCount: executionResult.nodeCount,
            executedNodes: executionResult.executedNodes
          }
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to execute workflow ${req.params.id}`, error);
      
      if (error.name === 'TimeoutError') {
        res.status(408).json({
          success: false,
          error: 'Workflow execution timeout',
          details: error.message
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, active = false } = req.body;
      const userId = this.getUserId(req);

      const workflow = await this.workflowService.getWorkflowById(id);
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      // Create duplicate
      const duplicate = {
        ...workflow,
        name: name || `${workflow.name} (Copy)`,
        description: description || workflow.description,
        active,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // Remove IDs from nodes
      if (duplicate.nodes) {
        duplicate.nodes = duplicate.nodes.map((node: any) => ({
          ...node,
          id: this.generateNodeId()
        }));
      }

      const createdWorkflow = await this.workflowService.createWorkflow(duplicate);

      res.status(201).json({
        success: true,
        data: createdWorkflow,
        message: 'Workflow duplicated successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to duplicate workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Activate/deactivate workflow
   */
  async toggleWorkflowActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const userId = this.getUserId(req);

      if (typeof active !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Active must be a boolean value'
        });
        return;
      }

      const workflow = await this.workflowService.getWorkflowById(id);
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      if (!this.hasWorkflowPermission(workflow, userId, 'write')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to modify this workflow'
        });
        return;
      }

      const updatedWorkflow = await this.workflowService.updateWorkflow(id, {
        active,
        updatedAt: new Date()
      });

      // Emit activation event
      this.workflowService.emitEvent('workflow:activated', {
        workflowId: id,
        active,
        userId,
        timestamp: new Date()
      });

      res.json({
        success: true,
        data: updatedWorkflow,
        message: `Workflow ${active ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error: any) {
      this.logger.error(`Failed to toggle workflow active ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get workflow versions
   */
  async getWorkflowVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 10, page = 1 } = req.query;

      const versions = await this.workflowService.getWorkflowVersions(id, {
        limit: parseInt(limit as string),
        page: parseInt(page as string)
      });

      res.json({
        success: true,
        data: versions.versions,
        pagination: {
          page: versions.page,
          limit: versions.limit,
          total: versions.total,
          pages: versions.pages
        }
      });
    } catch (error: any) {
      this.logger.error(`Failed to get workflow versions ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Restore workflow version
   */
  async restoreWorkflowVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, versionId } = req.params;
      const userId = this.getUserId(req);

      const restored = await this.workflowService.restoreWorkflowVersion(id, versionId);

      // Emit restore event
      this.workflowService.emitEvent('workflow:restored', {
        workflowId: id,
        versionId,
        userId,
        timestamp: new Date()
      });

      res.json({
        success: true,
        data: restored,
        message: 'Workflow version restored successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to restore workflow version ${req.params.id}/${req.params.versionId}`, error);
      next(error);
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const stats = await this.workflowService.getWorkflowStatistics(id, period as string);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      this.logger.error(`Failed to get workflow stats ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Import workflow from file
   */
  async importWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      // Parse file content
      const content = file.buffer.toString('utf-8');
      let workflowData;

      try {
        workflowData = JSON.parse(content);
      } catch (error: any) {
        // Try YAML
        const yaml = require('yaml');
        workflowData = yaml.parse(content);
      }

      // Validate workflow
      const validation = validateWorkflow(workflowData);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid workflow file',
          details: validation.errors
        });
        return;
      }

      // Prepare workflow
      const workflow = {
        ...workflowData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        active: false
      };

      const createdWorkflow = await this.workflowService.createWorkflow(workflow);

      res.status(201).json({
        success: true,
        data: createdWorkflow,
        message: 'Workflow imported successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to import workflow', error);
      next(error);
    }
  }

  /**
   * Export workflow
   */
  async exportWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { format = 'json', includeExecutions = false } = req.query;

      const workflow = await this.workflowService.getWorkflowById(id, {
        includeExecutions: includeExecutions === 'true'
      });

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      // Prepare export data
      const exportData = {
        ...workflow,
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0'
      };

      // Set response headers
      const filename = `workflow_${workflow.name || workflow.id}_${Date.now()}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'yaml') {
        const yaml = require('yaml');
        res.setHeader('Content-Type', 'application/x-yaml');
        res.send(yaml.stringify(exportData));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
      }
    } catch (error: any) {
      this.logger.error(`Failed to export workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get workflow webhooks
   */
  async getWorkflowWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const webhooks = await this.workflowService.getWorkflowWebhooks(id);

      res.json({
        success: true,
        data: webhooks
      });
    } catch (error: any) {
      this.logger.error(`Failed to get workflow webhooks ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Create workflow webhook
   */
  async createWorkflowWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { path, method = 'POST', nodeId, authentication } = req.body;
      const userId = this.getUserId(req);

      if (!path || !nodeId) {
        res.status(400).json({
          success: false,
          error: 'Path and nodeId are required'
        });
        return;
      }

      const webhook = await this.workflowService.createWebhook(id, {
        path,
        method,
        nodeId,
        authentication,
        createdBy: userId,
        createdAt: new Date(),
        active: true
      });

      res.status(201).json({
        success: true,
        data: webhook,
        message: 'Webhook created successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to create webhook for workflow ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Handle webhook request
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workflowId, webhookId } = req.params;
      const method = req.method;
      const headers = req.headers;
      const body = req.body;
      const query = req.query;

      // Find webhook
      const webhook = await this.workflowService.getWebhook(webhookId);
      
      if (!webhook || webhook.workflowId !== workflowId || !webhook.active) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found'
        });
        return;
      }

      // Check method
      if (webhook.method !== method) {
        res.status(405).json({
          success: false,
          error: `Method ${method} not allowed for this webhook`
        });
        return;
      }

      // Authenticate if required
      if (webhook.authentication) {
        const authResult = await this.authenticateWebhook(webhook.authentication, headers);
        if (!authResult.valid) {
          res.status(401).json({
            success: false,
            error: 'Authentication failed',
            details: authResult.error
          });
          return;
        }
      }

      // Prepare execution data
      const executionData = {
        headers,
        body,
        query,
        params: req.params,
        method,
        url: req.url,
        ip: req.ip,
        timestamp: new Date()
      };

      // Execute workflow
      const executionResult = await this.workflowExecutor.execute({
        workflowId,
        inputData: executionData,
        nodeId: webhook.nodeId,
        userId: 'webhook',
        saveExecution: true,
        webhookResponse: true,
        mode: 'sync'
      });

      // Send response
      if (executionResult.success && executionResult.data?.response) {
        const { status, headers: responseHeaders, body: responseBody } = executionResult.data.response;
        
        // Set headers
        if (responseHeaders) {
          Object.entries(responseHeaders).forEach(([key, value]) => {
            res.setHeader(key, value as string);
          });
        }

        res.status(status || 200).send(responseBody);
      } else {
        res.json({
          success: executionResult.success,
          data: executionResult.data,
          error: executionResult.error
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to handle webhook ${req.params.webhookId}`, error);
      next(error);
    }
  }

  /**
   * Search workflows
   */
  async searchWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, fields = 'name,description,tags', limit = 20 } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
        return;
      }

      const searchFields = (fields as string).split(',');
      
      const results = await this.workflowService.searchWorkflows(q, {
        fields: searchFields,
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: results,
        query: q,
        fields: searchFields
      });
    } catch (error: any) {
      this.logger.error('Failed to search workflows', error);
      next(error);
    }
  }

  /**
   * Bulk operations
   */
  async bulkOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operation, workflowIds, data } = req.body;
      const userId = this.getUserId(req);

      if (!operation || !workflowIds || !Array.isArray(workflowIds)) {
        res.status(400).json({
          success: false,
          error: 'Operation and workflowIds are required'
        });
        return;
      }

      let results;

      switch (operation) {
        case 'activate':
          results = await this.workflowService.bulkUpdateWorkflows(workflowIds, { active: true });
          break;
        
        case 'deactivate':
          results = await this.workflowService.bulkUpdateWorkflows(workflowIds, { active: false });
          break;
        
        case 'delete':
          results = await this.workflowService.bulkDeleteWorkflows(workflowIds);
          break;
        
        case 'duplicate':
          results = await this.workflowService.bulkDuplicateWorkflows(workflowIds, userId);
          break;
        
        case 'export':
          results = await this.workflowService.bulkExportWorkflows(workflowIds);
          break;
        
        default:
          res.status(400).json({
            success: false,
            error: `Unsupported operation: ${operation}`
          });
          return;
      }

      res.json({
        success: true,
        data: results,
        message: `Bulk operation '${operation}' completed successfully`
      });
    } catch (error: any) {
      this.logger.error('Failed to perform bulk operations', error);
      next(error);
    }
  }

  /**
   * Get workflow tags
   */
  async getWorkflowTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await this.workflowService.getAllWorkflowTags();

      res.json({
        success: true,
        data: tags
      });
    } catch (error: any) {
      this.logger.error('Failed to get workflow tags', error);
      next(error);
    }
  }

  // Helper methods
  private getUserId(req: Request): string {
    return (req as any).user?.id || 'anonymous';
  }

  private hasWorkflowPermission(workflow: any, userId: string, permission: 'read' | 'write' | 'delete'): boolean {
    // Check if user is owner
    if (workflow.userId === userId) {
      return true;
    }

    // Check if user is admin
    const user = (req: Request).user;
    if (user && user.role === 'admin') {
      return true;
    }

    // Check shared permissions
    if (workflow.sharedWith) {
      const userPermission = workflow.sharedWith.find((share: any) => share.userId === userId);
      if (userPermission && userPermission.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async authenticateWebhook(authentication: any, headers: any): Promise<{ valid: boolean; error?: string }> {
    try {
      if (authentication.type === 'apiKey') {
        const apiKey = headers['x-api-key'] || headers['authorization'];
        if (!apiKey || apiKey !== authentication.apiKey) {
          return { valid: false, error: 'Invalid API key' };
        }
      } else if (authentication.type === 'jwt') {
        const token = headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return { valid: false, error: 'No token provided' };
        }
        
        const decoded = await this.authService.verifyToken(token);
        if (!decoded) {
          return { valid: false, error: 'Invalid token' };
        }
      } else if (authentication.type === 'basic') {
        const authHeader = headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          return { valid: false, error: 'No basic auth header' };
        }
        
        const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
        const [username, password] = credentials.split(':');
        
        if (username !== authentication.username || password !== authentication.password) {
          return { valid: false, error: 'Invalid credentials' };
        }
      }
      
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

export default WorkflowController;
