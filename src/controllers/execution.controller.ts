import { Request, Response, NextFunction } from 'express';
import { ExecutionService } from '../core/execution/execution.service';
import { WorkflowService } from '../core/workflow/workflow.service';
import { WorkflowExecutor } from '../core/workflow/workflow.executor';
import { Logger } from '../utils/logger';
import { DatabaseService } from '../database/database.service';
import { EventBus } from '../core/event-bus/event.bus';
import { JsonFunctions } from '../json/src/json.functions';

export class ExecutionController {
  private executionService: ExecutionService;
  private workflowService: WorkflowService;
  private workflowExecutor: WorkflowExecutor;
  private logger: Logger;
  private jsonFunctions: JsonFunctions;

  constructor() {
    this.logger = new Logger('ExecutionController');
    const dbService = new DatabaseService();
    const eventBus = new EventBus();
    
    this.workflowService = new WorkflowService(dbService);
    this.executionService = new ExecutionService(dbService, eventBus);
    this.workflowExecutor = new WorkflowExecutor(this.workflowService, eventBus);
    this.jsonFunctions = new JsonFunctions();
  }

  /**
   * Get all executions with pagination and filtering
   */
  async getExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'startedAt',
        sortOrder = 'desc',
        workflowId,
        status,
        mode,
        userId,
        dateFrom,
        dateTo,
        search,
        includeData = false
      } = req.query;

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        workflowId: workflowId as string,
        status: status as string,
        mode: mode as string,
        userId: userId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        search: search as string,
        includeData: includeData === 'true'
      };

      const result = await this.executionService.getExecutions(options);
      
      res.json({
        success: true,
        data: result.executions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        },
        summary: {
          success: result.summary.success,
          failed: result.summary.failed,
          running: result.summary.running,
          waiting: result.summary.waiting,
          totalDuration: result.summary.totalDuration,
          avgDuration: result.summary.avgDuration
        }
      });
    } catch (error: any) {
      this.logger.error('Failed to get executions', error);
      next(error);
    }
  }

  /**
   * Get execution by ID
   */
  async getExecutionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { includeWorkflow = false, includeFullData = false } = req.query;

      const execution = await this.executionService.getExecutionById(id, {
        includeWorkflow: includeWorkflow === 'true',
        includeFullData: includeFullData === 'true'
      });

      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this execution'
        });
        return;
      }

      res.json({
        success: true,
        data: execution
      });
    } catch (error: any) {
      this.logger.error(`Failed to get execution ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get execution data (full execution data including node outputs)
   */
  async getExecutionData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { format = 'json', nodeId } = req.query;

      const execution = await this.executionService.getExecutionById(id, {
        includeFullData: true
      });

      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view this execution data'
        });
        return;
      }

      // Extract specific node data if requested
      let data = execution.data;
      if (nodeId) {
        data = this.extractNodeData(execution, nodeId as string);
      }

      // Format response based on requested format
      if (format === 'json') {
        res.json({
          success: true,
          data
        });
      } else if (format === 'raw') {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data, null, 2));
      } else if (format === 'csv') {
        const csvData = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="execution_${id}_data.csv"`);
        res.send(csvData);
      }
    } catch (error: any) {
      this.logger.error(`Failed to get execution data ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get executions for a specific workflow
   */
  async getWorkflowExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workflowId } = req.params;
      const {
        page = 1,
        limit = 50,
        status,
        dateFrom,
        dateTo,
        includeData = false
      } = req.query;

      // Check if workflow exists and user has permission
      const workflow = await this.workflowService.getWorkflowById(workflowId);
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      const userId = this.getUserId(req);
      if (!this.hasWorkflowPermission(workflow, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view executions for this workflow'
        });
        return;
      }

      const options = {
        workflowId,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        includeData: includeData === 'true'
      };

      const result = await this.executionService.getWorkflowExecutions(options);

      res.json({
        success: true,
        data: result.executions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        },
        workflow: {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active
        }
      });
    } catch (error: any) {
      this.logger.error(`Failed to get workflow executions ${req.params.workflowId}`, error);
      next(error);
    }
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        useOriginalData = true,
        additionalData = {},
        mode = 'sync',
        saveNewExecution = true
      } = req.body;

      const userId = this.getUserId(req);

      // Get the original execution
      const originalExecution = await this.executionService.getExecutionById(id, {
        includeFullData: true
      });

      if (!originalExecution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      if (!this.hasExecutionPermission(originalExecution, userId, 'write')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to retry this execution'
        });
        return;
      }

      // Prepare data for retry
      const inputData = useOriginalData 
        ? { 
            ...originalExecution.data?.input,
            ...additionalData 
          }
        : additionalData;

      // Create retry execution
      const retryResult = await this.executionService.retryExecution(id, {
        inputData,
        userId,
        mode: mode as 'sync' | 'async',
        saveNewExecution,
        retryOf: id
      });

      res.json({
        success: true,
        data: retryResult,
        message: 'Execution retry started successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to retry execution ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Stop a running execution
   */
  async stopExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { force = false } = req.body;
      const userId = this.getUserId(req);

      const execution = await this.executionService.getExecutionById(id);
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check if execution is running
      if (execution.status !== 'running') {
        res.status(400).json({
          success: false,
          error: `Execution is not running (current status: ${execution.status})`
        });
        return;
      }

      // Check permissions
      if (!this.hasExecutionPermission(execution, userId, 'write')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to stop this execution'
        });
        return;
      }

      // Stop the execution
      const stopped = await this.executionService.stopExecution(id, {
        force,
        stoppedBy: userId,
        reason: 'Stopped by user request'
      });

      res.json({
        success: true,
        data: stopped,
        message: 'Execution stopped successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to stop execution ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Delete an execution
   */
  async deleteExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;
      const userId = this.getUserId(req);

      const execution = await this.executionService.getExecutionById(id);
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      if (!this.hasExecutionPermission(execution, userId, 'delete')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this execution'
        });
        return;
      }

      // Delete execution
      const deleted = permanent === 'true'
        ? await this.executionService.deleteExecutionPermanently(id)
        : await this.executionService.deleteExecution(id);

      res.json({
        success: true,
        message: permanent === 'true' 
          ? 'Execution permanently deleted' 
          : 'Execution moved to trash'
      });
    } catch (error: any) {
      this.logger.error(`Failed to delete execution ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Bulk delete executions
   */
  async bulkDeleteExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { executionIds, permanent = false } = req.body;
      const userId = this.getUserId(req);

      if (!executionIds || !Array.isArray(executionIds)) {
        res.status(400).json({
          success: false,
          error: 'executionIds array is required'
        });
        return;
      }

      // Check permissions for all executions
      const executions = await this.executionService.getExecutionsByIds(executionIds);
      for (const execution of executions) {
        if (!this.hasExecutionPermission(execution, userId, 'delete')) {
          res.status(403).json({
            success: false,
            error: `You do not have permission to delete execution ${execution.id}`
          });
          return;
        }
      }

      // Bulk delete
      const result = await this.executionService.bulkDeleteExecutions(executionIds, permanent);

      res.json({
        success: true,
        data: result,
        message: `${result.successCount} execution(s) deleted successfully, ${result.failedCount} failed`
      });
    } catch (error: any) {
      this.logger.error('Failed to bulk delete executions', error);
      next(error);
    }
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        period = '30d',
        groupBy = 'day',
        workflowId,
        userId 
      } = req.query;

      const stats = await this.executionService.getExecutionStatistics({
        period: period as string,
        groupBy: groupBy as 'hour' | 'day' | 'week' | 'month',
        workflowId: workflowId as string,
        userId: userId as string
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      this.logger.error('Failed to get execution stats', error);
      next(error);
    }
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        level,
        limit = 100,
        offset = 0,
        format = 'json'
      } = req.query;

      const execution = await this.executionService.getExecutionById(id);
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view logs for this execution'
        });
        return;
      }

      const logs = await this.executionService.getExecutionLogs(id, {
        level: level as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      if (format === 'text') {
        // Format as plain text
        let textLogs = '';
        for (const log of logs) {
          textLogs += `[${new Date(log.timestamp).toISOString()}] [${log.level}] ${log.message}\n`;
          if (log.details) {
            textLogs += `Details: ${JSON.stringify(log.details, null, 2)}\n`;
          }
        }
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(textLogs);
      } else {
        // Return as JSON
        res.json({
          success: true,
          data: logs,
          execution: {
            id: execution.id,
            status: execution.status,
            workflowId: execution.workflowId
          }
        });
      }
    } catch (error: any) {
      this.logger.error(`Failed to get execution logs ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Stream execution logs in real-time
   */
  async streamExecutionLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const execution = await this.executionService.getExecutionById(id);
      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to stream logs for this execution'
        });
        return;
      }

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send initial data
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        executionId: id,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Subscribe to log events
      const unsubscribe = this.executionService.subscribeToExecutionLogs(id, (log) => {
        res.write(`data: ${JSON.stringify({
          type: 'log',
          data: log,
          timestamp: new Date().toISOString()
        })}\n\n`);
      });

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`);
      }, 30000);

      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        res.end();
      });
    } catch (error: any) {
      this.logger.error(`Failed to stream execution logs ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get execution timeline
   */
  async getExecutionTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const execution = await this.executionService.getExecutionById(id, {
        includeFullData: true
      });

      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to view timeline for this execution'
        });
        return;
      }

      const timeline = await this.executionService.getExecutionTimeline(id);

      res.json({
        success: true,
        data: timeline,
        execution: {
          id: execution.id,
          status: execution.status,
          duration: execution.duration,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt
        }
      });
    } catch (error: any) {
      this.logger.error(`Failed to get execution timeline ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Export execution data
   */
  async exportExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        format = 'json',
        includeLogs = true,
        includeTimeline = true
      } = req.query;

      const execution = await this.executionService.getExecutionById(id, {
        includeFullData: true,
        includeWorkflow: true
      });

      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Execution not found'
        });
        return;
      }

      // Check permissions
      const userId = this.getUserId(req);
      if (!this.hasExecutionPermission(execution, userId, 'read')) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to export this execution'
        });
        return;
      }

      // Prepare export data
      const exportData: any = {
        execution: {
          id: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          mode: execution.mode,
          startedAt: execution.startedAt,
          finishedAt: execution.finishedAt,
          duration: execution.duration,
          data: execution.data
        },
        workflow: execution.workflow ? {
          id: execution.workflow.id,
          name: execution.workflow.name,
          version: execution.workflow.version
        } : undefined,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0'
        }
      };

      // Include logs if requested
      if (includeLogs === 'true') {
        exportData.logs = await this.executionService.getExecutionLogs(id, { limit: 1000 });
      }

      // Include timeline if requested
      if (includeTimeline === 'true') {
        exportData.timeline = await this.executionService.getExecutionTimeline(id);
      }

      // Set response headers
      const filename = `execution_${id}_${Date.now()}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (format === 'yaml') {
        const yaml = require('yaml');
        res.setHeader('Content-Type', 'application/x-yaml');
        res.send(yaml.stringify(exportData));
      } else if (format === 'csv' && execution.data) {
        const csvData = this.convertToCSV(execution.data);
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
      }
    } catch (error: any) {
      this.logger.error(`Failed to export execution ${req.params.id}`, error);
      next(error);
    }
  }

  /**
   * Get execution errors
   */
  async getExecutionErrors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        page = 1,
        limit = 50,
        workflowId,
        dateFrom,
        dateTo,
        resolved = false
      } = req.query;

      const errors = await this.executionService.getExecutionErrors({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        workflowId: workflowId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        resolved: resolved === 'true'
      });

      res.json({
        success: true,
        data: errors.errors,
        pagination: {
          page: errors.page,
          limit: errors.limit,
          total: errors.total,
          pages: errors.pages
        },
        summary: {
          totalErrors: errors.summary.totalErrors,
          resolvedErrors: errors.summary.resolvedErrors,
          unresolvedErrors: errors.summary.unresolvedErrors,
          mostCommonError: errors.summary.mostCommonError
        }
      });
    } catch (error: any) {
      this.logger.error('Failed to get execution errors', error);
      next(error);
    }
  }

  /**
   * Mark execution error as resolved
   */
  async resolveExecutionError(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { errorId } = req.params;
      const { resolution, resolvedBy } = req.body;
      const userId = this.getUserId(req);

      const resolvedError = await this.executionService.resolveExecutionError(errorId, {
        resolution,
        resolvedBy: resolvedBy || userId,
        resolvedAt: new Date()
      });

      res.json({
        success: true,
        data: resolvedError,
        message: 'Execution error marked as resolved'
      });
    } catch (error: any) {
      this.logger.error(`Failed to resolve execution error ${req.params.errorId}`, error);
      next(error);
    }
  }

  /**
   * Get execution performance metrics
   */
  async getExecutionMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        period = '7d',
        workflowId,
        nodeType
      } = req.query;

      const metrics = await this.executionService.getPerformanceMetrics({
        period: period as string,
        workflowId: workflowId as string,
        nodeType: nodeType as string
      });

      res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      this.logger.error('Failed to get execution metrics', error);
      next(error);
    }
  }

  /**
   * Clean up old executions
   */
  async cleanupExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        olderThan = '30d',
        status = 'success',
        dryRun = true
      } = req.body;

      const userId = this.getUserId(req);

      // Only admins can perform cleanup
      if (!this.isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: 'Only administrators can perform execution cleanup'
        });
        return;
      }

      const cleanupResult = await this.executionService.cleanupExecutions({
        olderThan: olderThan as string,
        status: status as string,
        dryRun: dryRun === true || dryRun === 'true',
        initiatedBy: userId
      });

      res.json({
        success: true,
        data: cleanupResult,
        message: dryRun 
          ? 'Cleanup simulation completed' 
          : 'Executions cleanup completed'
      });
    } catch (error: any) {
      this.logger.error('Failed to cleanup executions', error);
      next(error);
    }
  }

  /**
   * Get execution queue status
   */
  async getQueueStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queueStatus = await this.executionService.getQueueStatus();

      res.json({
        success: true,
        data: queueStatus
      });
    } catch (error: any) {
      this.logger.error('Failed to get queue status', error);
      next(error);
    }
  }

  /**
   * Clear execution queue
   */
  async clearQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { queueType = 'all' } = req.body;
      const userId = this.getUserId(req);

      // Only admins can clear queue
      if (!this.isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: 'Only administrators can clear execution queue'
        });
        return;
      }

      const result = await this.executionService.clearQueue(queueType as string, userId);

      res.json({
        success: true,
        data: result,
        message: 'Execution queue cleared successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to clear execution queue', error);
      next(error);
    }
  }

  /**
   * Get execution webhook responses
   */
  async getWebhookResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { executionId } = req.params;
      const { limit = 50 } = req.query;

      const webhookResponses = await this.executionService.getWebhookResponses(executionId, {
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: webhookResponses
      });
    } catch (error: any) {
      this.logger.error(`Failed to get webhook responses for execution ${req.params.executionId}`, error);
      next(error);
    }
  }

  // Helper methods
  private getUserId(req: Request): string {
    return (req as any).user?.id || 'anonymous';
  }

  private isAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user && user.role === 'admin';
  }

  private hasExecutionPermission(execution: any, userId: string, permission: 'read' | 'write' | 'delete'): boolean {
    // Admins have all permissions
    const user = (req: Request).user;
    if (user && user.role === 'admin') {
      return true;
    }

    // Check if user is the execution owner
    if (execution.userId === userId) {
      return true;
    }

    // Check workflow permissions
    if (execution.workflow) {
      return this.hasWorkflowPermission(execution.workflow, userId, permission);
    }

    return false;
  }

  private hasWorkflowPermission(workflow: any, userId: string, permission: 'read' | 'write' | 'delete'): boolean {
    // Check if user is workflow owner
    if (workflow.userId === userId) {
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

  private extractNodeData(execution: any, nodeId: string): any {
    if (!execution.data?.nodes) {
      return null;
    }

    const nodeData = execution.data.nodes[nodeId];
    if (!nodeData) {
      return null;
    }

    return {
      nodeId,
      nodeName: nodeData.name || nodeId,
      parameters: nodeData.parameters,
      input: nodeData.input,
      output: nodeData.output,
      status: nodeData.status,
      duration: nodeData.duration,
      startedAt: nodeData.startedAt,
      finishedAt: nodeData.finishedAt,
      error: nodeData.error
    };
  }

  private convertToCSV(data: any): string {
    if (!data) return '';

    const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc: any, key) => {
        const pre = prefix.length ? `${prefix}.` : '';
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(acc, flattenObject(obj[key], pre + key));
        } else {
          acc[pre + key] = obj[key];
        }
        return acc;
      }, {});
    };

    const flattened = flattenObject(data);
    const headers = Object.keys(flattened).join(',');
    const values = Object.values(flattened).map(val => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
      return String(val);
    }).join(',');

    return `${headers}\n${values}`;
  }
}

export default ExecutionController;
