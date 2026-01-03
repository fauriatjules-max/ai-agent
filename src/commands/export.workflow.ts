import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { WorkflowService } from '../core/workflow/workflow.service';
import { DatabaseService } from '../database/database.service';
import { Logger } from '../utils/logger';
import { format } from 'date-fns';

export class ExportWorkflowCommand {
  private program: Command;
  private workflowService: WorkflowService;
  private logger: Logger;
  private dbService: DatabaseService;

  constructor() {
    this.logger = new Logger('ExportWorkflow');
    this.dbService = new DatabaseService();
    this.workflowService = new WorkflowService(this.dbService);
    this.program = new Command();
    
    this.setupCommand();
  }

  private setupCommand(): void {
    this.program
      .name('export-workflow')
      .description('Export workflows to JSON files')
      .version('1.0.0')
      .option('-i, --id <id>', 'Export specific workflow by ID')
      .option('-n, --name <name>', 'Export workflows by name (supports wildcards)')
      .option('-t, --type <type>', 'Export workflows by type (production, test, development)')
      .option('-u, --user-id <id>', 'Export workflows by user ID')
      .option('-a, --all', 'Export all workflows', false)
      .option('-o, --output <path>', 'Output file or directory path', './exports')
      .option('-f, --format <format>', 'Output format (json, yaml)', 'json')
      .option('--include-executions', 'Include execution history', false)
      .option('--include-metadata', 'Include metadata and stats', false)
      .option('--pretty', 'Pretty print JSON output', true)
      .option('--compress', 'Compress output (gzip)', false)
      .option('--batch-size <number>', 'Number of workflows per file (0 = single file)', '0')
      .option('--since <date>', 'Export workflows updated since date (YYYY-MM-DD)')
      .option('--until <date>', 'Export workflows updated until date (YYYY-MM-DD)')
      .option('-v, --verbose', 'Verbose output', false);
  }

  async execute(): Promise<void> {
    try {
      // Parse command line arguments
      this.program.parse(process.argv);
      const options = this.program.opts();

      // Validate options
      this.validateOptions(options);

      // Initialize database connection
      await this.dbService.initialize();

      // Execute export
      await this.processExport(options);

      this.logger.info('Export completed successfully');
      process.exit(0);
    } catch (error: any) {
      this.logger.error(`Export failed: ${error.message}`, error);
      process.exit(1);
    } finally {
      await this.dbService.disconnect();
    }
  }

  private validateOptions(options: any): void {
    const { id, name, type, userId, all } = options;
    
    if (!id && !name && !type && !userId && !all) {
      throw new Error('Please specify at least one filter option (--id, --name, --type, --user-id, --all)');
    }
  }

  private async processExport(options: any): Promise<void> {
    const {
      id,
      name,
      type,
      userId,
      all,
      output,
      format,
      includeExecutions,
      includeMetadata,
      pretty,
      compress,
      batchSize,
      since,
      until,
      verbose
    } = options;

    // Build query filters
    const filters: any = {};
    
    if (id) filters.id = id;
    if (name) filters.name = { $like: `%${name}%` };
    if (type) filters.type = type;
    if (userId) filters.userId = userId;
    if (since) filters.updatedAt = { $gte: new Date(since) };
    if (until) filters.updatedAt = { $lte: new Date(until) };

    this.logger.info('Fetching workflows...');
    
    // Fetch workflows
    const workflows = all && !id && !name && !type && !userId
      ? await this.workflowService.getAllWorkflows()
      : await this.workflowService.findWorkflows(filters);

    if (workflows.length === 0) {
      this.logger.warn('No workflows found matching the criteria');
      return;
    }

    this.logger.info(`Found ${workflows.length} workflow(s)`);

    // Prepare workflows for export
    const exportData = await this.prepareExportData(workflows, {
      includeExecutions,
      includeMetadata,
      verbose
    });

    // Determine output structure
    const batchSizeNum = parseInt(batchSize, 10);
    const shouldBatch = batchSizeNum > 0 && workflows.length > batchSizeNum;

    if (shouldBatch) {
      await this.exportBatches(exportData, output, format, batchSizeNum, {
        pretty,
        compress,
        verbose
      });
    } else {
      await this.exportSingle(exportData, output, format, {
        pretty,
        compress,
        verbose
      });
    }
  }

  private async prepareExportData(
    workflows: any[],
    options: any
  ): Promise<any[]> {
    const { includeExecutions, includeMetadata, verbose } = options;
    
    const preparedWorkflows = [];

    for (const workflow of workflows) {
      try {
        const prepared: any = {
          ...workflow,
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0'
        };

        // Include executions if requested
        if (includeExecutions) {
          const executions = await this.workflowService.getWorkflowExecutions(workflow.id, {
            limit: 100,
            order: 'desc'
          });
          prepared.executions = executions;
        }

        // Include metadata if requested
        if (includeMetadata) {
          prepared.metadata = {
            nodeCount: workflow.nodes?.length || 0,
            connectionsCount: this.countConnections(workflow.connections),
            stats: await this.workflowService.getWorkflowStats(workflow.id),
            dependencies: this.extractDependencies(workflow)
          };
        }

        // Clean up internal fields
        delete prepared._id;
        delete prepared.__v;
        delete prepared.internalId;

        preparedWorkflows.push(prepared);

        if (verbose) {
          this.logger.debug(`Prepared workflow: ${workflow.name || workflow.id}`);
        }
      } catch (error: any) {
        this.logger.warn(`Failed to prepare workflow ${workflow.id}: ${error.message}`);
      }
    }

    return preparedWorkflows;
  }

  private async exportSingle(
    data: any[],
    output: string,
    format: string,
    options: any
  ): Promise<void> {
    const { pretty, compress, verbose } = options;
    
    // Determine output file path
    let outputPath = output;
    const isDirectory = !output.includes('.') || output.endsWith('/');
    
    if (isDirectory) {
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const filename = `workflows_${timestamp}.${format}`;
      outputPath = join(output, filename);
    }

    // Create directory if needed
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Export data
    await this.writeExportFile(outputPath, data, format, {
      pretty,
      compress,
      verbose
    });

    this.logger.info(`Exported ${data.length} workflow(s) to: ${outputPath}`);
  }

  private async exportBatches(
    data: any[],
    outputDir: string,
    format: string,
    batchSize: number,
    options: any
  ): Promise<void> {
    const { pretty, compress, verbose } = options;
    
    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    let exportedCount = 0;

    // Split data into batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      const filename = `workflows_${timestamp}_batch${batchNum}.${format}`;
      const outputPath = join(outputDir, filename);

      await this.writeExportFile(outputPath, batch, format, {
        pretty,
        compress,
        verbose
      });

      exportedCount += batch.length;
      this.logger.info(`Batch ${batchNum} exported: ${outputPath}`);
    }

    // Create manifest file
    const manifest = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalWorkflows: data.length,
        batches: Math.ceil(data.length / batchSize),
        batchSize,
        format,
        options
      },
      files: Array.from({ length: Math.ceil(data.length / batchSize) }, (_, i) => ({
        filename: `workflows_${timestamp}_batch${i + 1}.${format}`,
        workflows: batchSize,
        firstWorkflow: i * batchSize,
        lastWorkflow: Math.min((i + 1) * batchSize, data.length) - 1
      }))
    };

    const manifestPath = join(outputDir, `manifest_${timestamp}.json`);
    writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, pretty ? 2 : 0),
      'utf-8'
    );

    this.logger.info(`Exported ${exportedCount} workflow(s) in ${Math.ceil(data.length / batchSize)} batch(es)`);
    this.logger.info(`Manifest created: ${manifestPath}`);
  }

  private async writeExportFile(
    path: string,
    data: any,
    format: string,
    options: any
  ): Promise<void> {
    const { pretty, compress, verbose } = options;
    
    let content: string;

    // Format content
    if (format === 'yaml') {
      const yaml = require('yaml');
      content = yaml.stringify(data, {
        indent: 2,
        lineWidth: 120
      });
    } else {
      content = JSON.stringify(data, null, pretty ? 2 : 0);
    }

    // Compress if requested
    if (compress) {
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(content);
      writeFileSync(path, compressed);
    } else {
      writeFileSync(path, content, 'utf-8');
    }

    if (verbose) {
      this.logger.debug(`File written: ${path} (${content.length} bytes)`);
    }
  }

  private countConnections(connections: any): number {
    if (!connections) return 0;
    
    let count = 0;
    for (const nodeConnections of Object.values(connections)) {
      if (Array.isArray(nodeConnections)) {
        count += nodeConnections.length;
      } else if (typeof nodeConnections === 'object') {
        count += Object.keys(nodeConnections).length;
      }
    }
    return count;
  }

  private extractDependencies(workflow: any): string[] {
    const dependencies = new Set<string>();
    
    if (workflow.nodes) {
      for (const node of workflow.nodes) {
        if (node.type) {
          dependencies.add(node.type);
        }
        if (node.credentials) {
          for (const credType of Object.keys(node.credentials)) {
            dependencies.add(`credential:${credType}`);
          }
        }
      }
    }
    
    return Array.from(dependencies);
  }

  // Advanced export methods
  public async exportToArchive(outputPath: string, options: any = {}): Promise<string> {
    this.logger.info(`Exporting to archive: ${outputPath}`);
    
    const fs = require('fs');
    const archiver = require('archiver');
    const os = require('os');
    const path = require('path');
    
    // Create temp directory
    const tempDir = path.join(os.tmpdir(), `export-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    try {
      // Export workflows to temp directory
      const exportOptions = {
        ...options,
        output: tempDir,
        batchSize: 50, // Export in batches for large collections
        verbose: false
      };
      
      await this.processExport(exportOptions);
      
      // Create archive
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      archive.pipe(output);
      archive.directory(tempDir, false);
      
      await archive.finalize();
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      this.logger.info(`Archive created: ${outputPath}`);
      return outputPath;
      
    } catch (error: any) {
      // Cleanup on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  public async exportToRemote(url: string, options: any = {}): Promise<any> {
    this.logger.info(`Exporting to remote: ${url}`);
    
    const axios = require('axios');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    // Create temp file
    const tempFile = path.join(os.tmpdir(), `export-${Date.now()}.json`);
    
    try {
      // Export to temp file
      await this.exportSingle(
        await this.prepareExportData(
          await this.workflowService.getAllWorkflows(),
          options
        ),
        tempFile,
        'json',
        { pretty: true, compress: false, verbose: false }
      );
      
      // Upload to remote
      const fileContent = fs.readFileSync(tempFile, 'utf-8');
      const response = await axios.post(url, {
        data: JSON.parse(fileContent),
        metadata: {
          exportedAt: new Date().toISOString(),
          count: JSON.parse(fileContent).length
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Cleanup
      fs.unlinkSync(tempFile);
      
      this.logger.info(`Export uploaded successfully`);
      return response.data;
      
    } catch (error: any) {
      // Cleanup on error
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      throw new Error(`Failed to export to remote: ${error.message}`);
    }
  }

  public async exportSchema(outputPath: string): Promise<void> {
    this.logger.info(`Exporting workflow schema to: ${outputPath}`);
    
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Workflow Schema',
      description: 'Schema definition for n8n workflows',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name'
        },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              position: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2
              },
              parameters: { type: 'object' }
            },
            required: ['id', 'name', 'type', 'position']
          }
        },
        connections: {
          type: 'object',
          additionalProperties: true
        },
        settings: {
          type: 'object',
          properties: {
            saveExecutionProgress: { type: 'boolean' },
            saveManualExecutions: { type: 'boolean' },
            saveDataErrorExecution: { type: 'string' },
            saveDataSuccessExecution: { type: 'string' },
            executionTimeout: { type: 'number' },
            timezone: { type: 'string' }
          }
        },
        staticData: { type: 'object' },
        version: { type: 'number' },
        active: { type: 'boolean' }
      },
      required: ['name', 'nodes']
    };
    
    writeFileSync(
      outputPath,
      JSON.stringify(schema, null, 2),
      'utf-8'
    );
    
    this.logger.info(`Schema exported successfully`);
  }
}

// CLI entry point
if (require.main === module) {
  const command = new ExportWorkflowCommand();
  command.execute().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
