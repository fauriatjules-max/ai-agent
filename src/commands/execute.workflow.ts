import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { WorkflowExecutor } from '../core/workflow/workflow.executor';
import { DatabaseService } from '../database/database.service';
import { Logger } from '../utils/logger';
import { EventBus } from '../core/event-bus/event.bus';
import { WorkflowService } from '../core/workflow/workflow.service';

export class ExecuteWorkflowCommand {
  private program: Command;
  private workflowExecutor: WorkflowExecutor;
  private workflowService: WorkflowService;
  private logger: Logger;
  private dbService: DatabaseService;
  private eventBus: EventBus;

  constructor() {
    this.logger = new Logger('ExecuteWorkflow');
    this.dbService = new DatabaseService();
    this.eventBus = new EventBus();
    this.workflowService = new WorkflowService(this.dbService);
    this.workflowExecutor = new WorkflowExecutor(this.workflowService, this.eventBus);
    
    this.program = new Command();
    
    this.setupCommand();
  }

  private setupCommand(): void {
    this.program
      .name('execute-workflow')
      .description('Execute workflows from CLI')
      .version('1.0.0')
      .option('-i, --id <id>', 'Execute workflow by ID')
      .option('-f, --file <path>', 'Execute workflow from JSON file')
      .option('-d, --data <json>', 'Input data as JSON string')
      .option('--data-file <path>', 'Input data from JSON file')
      .option('-n, --node <node>', 'Execute specific node only')
      .option('-r, --raw', 'Output raw execution result', false)
      .option('-j, --json', 'Output as JSON', false)
      .option('--async', 'Execute asynchronously', false)
      .option('--timeout <ms>', 'Execution timeout in milliseconds', '30000')
      .option('--retry <count>', 'Number of retries on failure', '0')
      .option('--retry-delay <ms>', 'Delay between retries in milliseconds', '1000')
      .option('--save-execution', 'Save execution results to database', false)
      .option('--dry-run', 'Validate without executing', false)
      .option('--debug', 'Enable debug mode', false)
      .option('--verbose', 'Verbose output', false)
      .option('--output <path>', 'Output results to file')
      .option('--format <format>', 'Output format (json, yaml, text)', 'json')
      .option('--webhook-url <url>', 'Send results to webhook URL')
      .option('--email <email>', 'Send results to email')
      .option('--notify', 'Send notification on completion', false);
  }

  async execute(): Promise<void> {
    try {
      // Parse command line arguments
      this.program.parse(process.argv);
      const options = this.program.opts();

      // Validate options
      this.validateOptions(options);

      // Initialize services
      await this.dbService.initialize();
      await this.workflowExecutor.initialize();

      // Execute workflow
      const result = await this.processExecution(options);

      // Handle output
      await this.handleOutput(result, options);

      this.logger.info('Execution completed successfully');
      process.exit(0);
    } catch (error: any) {
      this.logger.error(`Execution failed: ${error.message}`, error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private validateOptions(options: any): void {
    const { id, file } = options;
    
    if (!id && !file) {
      throw new Error('Please specify either --id or --file');
    }
  }

  private async processExecution(options: any): Promise<any> {
    const {
      id,
      file,
      data,
      dataFile,
      node,
      raw,
      json,
      async,
      timeout,
      retry,
      retryDelay,
      saveExecution,
      dryRun,
      debug,
      verbose,
      notify
    } = options;

    // Load workflow
    const workflow = await this.loadWorkflow(id, file);
    
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    this.logger.info(`Executing workflow: ${workflow.name || workflow.id}`);

    // Load input data
    const inputData = await this.loadInputData(data, dataFile);

    // Prepare execution options
    const executionOptions = {
      workflowId: workflow.id,
      inputData,
      nodeId: node,
      rawOutput: raw,
      timeout: parseInt(timeout, 10),
      retry: parseInt(retry, 10),
      retryDelay: parseInt(retryDelay, 10),
      saveExecution,
      dryRun,
      debug,
      verbose,
      notify,
      mode: async ? 'async' : 'sync' as const
    };

    // Execute workflow
    const startTime = Date.now();
    
    try {
      const result = await this.workflowExecutor.execute(executionOptions);
      
      const executionTime = Date.now() - startTime;
      result.metrics = {
        executionTime,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString()
      };

      return result;
    } catch (error: any) {
      this.logger.error(`Workflow execution error: ${error.message}`);
      
      // Create error result
      return {
        success: false,
        error: {
          message: error.message,
          stack: debug ? error.stack : undefined,
          code: error.code || 'EXECUTION_ERROR'
        },
        workflowId: workflow.id,
        executionId: `error-${Date.now()}`,
        metrics: {
          executionTime: Date.now() - startTime,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString()
        }
      };
    }
  }

  private async loadWorkflow(id?: string, file?: string): Promise<any> {
    if (id) {
      // Load from database
      return await this.workflowService.getWorkflowById(id);
    } else if (file) {
      // Load from file
      if (!existsSync(file)) {
        throw new Error(`Workflow file not found: ${file}`);
      }

      const content = readFileSync(file, 'utf-8');
      const workflow = JSON.parse(content);

      // Validate workflow
      const validation = this.validateWorkflow(workflow);
      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }

      return workflow;
    }

    return null;
  }

  private async loadInputData(data?: string, dataFile?: string): Promise<any> {
    if (data) {
      // Parse JSON data from string
      try {
        return JSON.parse(data);
      } catch (error: any) {
        throw new Error(`Invalid JSON data: ${error.message}`);
      }
    } else if (dataFile) {
      // Load data from file
      if (!existsSync(dataFile)) {
        throw new Error(`Data file not found: ${dataFile}`);
      }

      const content = readFileSync(dataFile, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (error: any) {
        throw new Error(`Invalid JSON in data file: ${error.message}`);
      }
    }

    // Default empty data
    return {};
  }

  private validateWorkflow(workflow: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workflow) {
      errors.push('Workflow is null or undefined');
      return { valid: false, errors };
    }

    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      errors.push('Workflow must have a nodes array');
    }

    if (workflow.nodes) {
      for (let i = 0; i < workflow.nodes.length; i++) {
        const node = workflow.nodes[i];
        if (!node.id) errors.push(`Node at index ${i} missing id`);
        if (!node.name) errors.push(`Node at index ${i} missing name`);
        if (!node.type) errors.push(`Node at index ${i} missing type`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async handleOutput(result: any, options: any): Promise<void> {
    const {
      raw,
      json,
      output,
      format,
      webhookUrl,
      email,
      verbose
    } = options;

    // Determine output format
    let outputContent: string;
    
    if (json || format === 'json') {
      outputContent = JSON.stringify(result, null, 2);
    } else if (format === 'yaml') {
      const yaml = require('yaml');
      outputContent = yaml.stringify(result);
    } else if (raw) {
      // Extract raw data
      outputContent = result.data ? JSON.stringify(result.data, null, 2) : '';
    } else {
      // Human readable format
      outputContent = this.formatHumanReadable(result);
    }

    // Output to console
    if (!output) {
      console.log(outputContent);
    }

    // Output to file
    if (output) {
      const fs = require('fs');
      const dir = require('path').dirname(output);
      
      if (!existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(output, outputContent, 'utf-8');
      this.logger.info(`Output written to: ${output}`);
    }

    // Send to webhook
    if (webhookUrl) {
      await this.sendToWebhook(result, webhookUrl);
    }

    // Send to email
    if (email) {
      await this.sendToEmail(result, email);
    }

    // Log verbose details
    if (verbose) {
      this.logVerboseDetails(result);
    }
  }

  private formatHumanReadable(result: any): string {
    const lines: string[] = [];
    
    lines.push('=== Workflow Execution Result ===');
    lines.push(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    lines.push(`Workflow ID: ${result.workflowId}`);
    lines.push(`Execution ID: ${result.executionId}`);
    
    if (result.metrics) {
      lines.push(`Execution Time: ${result.metrics.executionTime}ms`);
      lines.push(`Start Time: ${result.metrics.startTime}`);
      lines.push(`End Time: ${result.metrics.endTime}`);
    }
    
    if (result.data) {
      lines.push('\n=== Output Data ===');
      lines.push(JSON.stringify(result.data, null, 2));
    }
    
    if (result.error) {
      lines.push('\n=== Error ===');
      lines.push(`Message: ${result.error.message}`);
      lines.push(`Code: ${result.error.code}`);
    }
    
    if (result.nodes) {
      lines.push('\n=== Node Execution Summary ===');
      for (const [nodeId, nodeResult] of Object.entries(result.nodes)) {
        const node = nodeResult as any;
        lines.push(`${nodeId}: ${node.success ? '✓' : '✗'} (${node.duration || 0}ms)`);
      }
    }
    
    return lines.join('\n');
  }

  private async sendToWebhook(result: any, webhookUrl: string): Promise<void> {
    try {
      const axios = require('axios');
      
      await axios.post(webhookUrl, {
        event: 'workflow_execution',
        timestamp: new Date().toISOString(),
        data: result
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      this.logger.info(`Results sent to webhook: ${webhookUrl}`);
    } catch (error: any) {
      this.logger.warn(`Failed to send to webhook: ${error.message}`);
    }
  }

  private async sendToEmail(result: any, email: string): Promise<void> {
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        // Configure based on your email settings
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      const subject = `Workflow Execution: ${result.success ? 'Success' : 'Failed'}`;
      const text = this.formatHumanReadable(result);
      const html = this.formatHtmlEmail(result);
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'n8n-clone@example.com',
        to: email,
        subject,
        text,
        html
      });
      
      this.logger.info(`Results sent to email: ${email}`);
    } catch (error: any) {
      this.logger.warn(`Failed to send email: ${error.message}`);
    }
  }

  private formatHtmlEmail(result: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .success { color: green; }
          .error { color: red; }
          .metric { margin: 10px 0; }
          .data { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Workflow Execution Result</h1>
        <div class="metric">
          <strong>Status:</strong> 
          <span class="${result.success ? 'success' : 'error'}">
            ${result.success ? 'SUCCESS' : 'FAILED'}
          </span>
        </div>
        <div class="metric"><strong>Workflow ID:</strong> ${result.workflowId}</div>
        <div class="metric"><strong>Execution ID:</strong> ${result.executionId}</div>
        <div class="metric"><strong>Execution Time:</strong> ${result.metrics?.executionTime || 0}ms</div>
        
        ${result.data ? `
          <h2>Output Data</h2>
          <pre class="data">${JSON.stringify(result.data, null, 2)}</pre>
        ` : ''}
        
        ${result.error ? `
          <h2>Error Details</h2>
          <div class="error">
            <strong>Message:</strong> ${result.error.message}<br>
            <strong>Code:</strong> ${result.error.code}
          </div>
        ` : ''}
      </body>
      </html>
    `;
  }

  private logVerboseDetails(result: any): void {
    this.logger.debug('=== Verbose Execution Details ===');
    
    if (result.executionTrace) {
      this.logger.debug('Execution Trace:');
      for (const trace of result.executionTrace) {
        this.logger.debug(`  ${trace.node}: ${trace.status} (${trace.duration}ms)`);
      }
    }
    
    if (result.memoryUsage) {
      this.logger.debug(`Memory Usage: ${Math.round(result.memoryUsage / 1024 / 1024)}MB`);
    }
    
    if (result.nodeDetails) {
      this.logger.debug('Node Details:');
      for (const [nodeId, details] of Object.entries(result.nodeDetails)) {
        this.logger.debug(`  ${nodeId}:`, details);
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.workflowExecutor.shutdown();
      await this.dbService.disconnect();
      await this.eventBus.shutdown();
    } catch (error: any) {
      this.logger.warn(`Cleanup error: ${error.message}`);
    }
  }

  // Advanced execution methods
  public async executeBatch(workflowIds: string[], options: any = {}): Promise<any[]> {
    this.logger.info(`Executing batch of ${workflowIds.length} workflows`);
    
    const results = [];
    const { parallel = false, maxConcurrent = 3 } = options;

    if (parallel) {
      // Execute in parallel with concurrency limit
      const { default: pLimit } = require('p-limit');
      const limit = pLimit(maxConcurrent);
      
      const promises = workflowIds.map(id => 
        limit(() => this.executeWorkflowById(id, options))
      );
      
      results.push(...await Promise.all(promises));
    } else {
      // Execute sequentially
      for (const id of workflowIds) {
        try {
          const result = await this.executeWorkflowById(id, options);
          results.push(result);
        } catch (error: any) {
          results.push({
            workflowId: id,
            success: false,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  private async executeWorkflowById(id: string, options: any): Promise<any> {
    const workflow = await this.workflowService.getWorkflowById(id);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    const executionOptions = {
      workflowId: id,
      inputData: options.data || {},
      timeout: options.timeout || 30000,
      saveExecution: options.saveExecution || false,
      mode: 'sync' as const
    };

    return await this.workflowExecutor.execute(executionOptions);
  }

  public async scheduleExecution(cronExpression: string, options: any = {}): Promise<void> {
    this.logger.info(`Scheduling workflow execution: ${cronExpression}`);
    
    const cron = require('node-cron');
    const { id, file, data } = options;
    
    const task = cron.schedule(cronExpression, async () => {
      try {
        this.logger.info(`Running scheduled execution: ${new Date().toISOString()}`);
        
        const result = await this.processExecution({
          id,
          file,
          data,
          ...options
        });
        
        if (options.notify) {
          await this.handleNotification(result, options);
        }
        
      } catch (error: any) {
        this.logger.error(`Scheduled execution failed: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: options.timezone || 'UTC'
    });
    
    // Return control object
    return {
      start: () => task.start(),
      stop: () => task.stop(),
      destroy: () => task.destroy()
    } as any;
  }

  private async handleNotification(result: any, options: any): Promise<void> {
    // Implement notification logic
    if (options.email) {
      await this.sendToEmail(result, options.email);
    }
    
    if (options.webhookUrl) {
      await this.sendToWebhook(result, options.webhookUrl);
    }
    
    // Add other notification methods as needed
  }

  public async executeWithRetry(executionOptions: any, maxRetries: number = 3): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Execution attempt ${attempt}/${maxRetries}`);
        return await this.workflowExecutor.execute(executionOptions);
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = executionOptions.retryDelay || 1000;
          this.logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }
}

// CLI entry point
if (require.main === module) {
  const command = new ExecuteWorkflowCommand();
  command.execute().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
