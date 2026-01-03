import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { WorkflowService } from '../core/workflow/workflow.service';
import { DatabaseService } from '../database/database.service';
import { Logger } from '../utils/logger';
import { validateWorkflow } from '../api/validators/workflow.validator';

export class ImportWorkflowCommand {
  private program: Command;
  private workflowService: WorkflowService;
  private logger: Logger;
  private dbService: DatabaseService;

  constructor() {
    this.logger = new Logger('ImportWorkflow');
    this.dbService = new DatabaseService();
    this.workflowService = new WorkflowService(this.dbService);
    this.program = new Command();
    
    this.setupCommand();
  }

  private setupCommand(): void {
    this.program
      .name('import-workflow')
      .description('Import workflows from JSON files or directories')
      .version('1.0.0')
      .requiredOption('-i, --input <path>', 'Input file or directory path')
      .option('-o, --output-dir <path>', 'Output directory for processed files', './imported')
      .option('-f, --format <format>', 'Input format (json, yaml)', 'json')
      .option('-u, --user-id <id>', 'User ID to associate workflows with')
      .option('-t, --type <type>', 'Workflow type (production, test, development)', 'production')
      .option('-d, --dry-run', 'Validate without importing', false)
      .option('-v, --verbose', 'Verbose output', false)
      .option('--overwrite', 'Overwrite existing workflows', false)
      .option('--skip-validation', 'Skip workflow validation', false);
  }

  async execute(): Promise<void> {
    try {
      this.program.parse(process.argv);
      const options = this.program.opts();
      
      await this.dbService.initialize();

      await this.processImport(options);

      this.logger.info('Import completed successfully');
      process.exit(0);
    } catch (error: any) {
      this.logger.error(`Import failed: ${error.message}`, error);
      process.exit(1);
    } finally {
      await this.dbService.disconnect();
    }
  }

  private async processImport(options: any): Promise<void> {
    const { input, outputDir, format, userId, type, dryRun, verbose, overwrite, skipValidation } = options;

    this.logger.info(`Starting import from: ${input}`);
    
    
    if (!existsSync(input)) {
      throw new Error(`Input path does not exist: ${input}`);
    }

    // Get file list
    const files = await this.getFiles(input, format);
    
    if (files.length === 0) {
      this.logger.warn('No workflow files found');
      return;
    }

    this.logger.info(`Found ${files.length} workflow file(s)`);

    // Create output directory if needed
    if (dryRun && outputDir && !existsSync(outputDir)) {
      require('fs').mkdirSync(outputDir, { recursive: true });
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each file
    for (const file of files) {
      try {
        const result = await this.processFile(file, {
          outputDir,
          userId,
          type,
          dryRun,
          verbose,
          overwrite,
          skipValidation
        });

        if (result.status === 'success') {
          successCount++;
          this.logger.info(`✓ ${file} imported successfully`);
        } else if (result.status === 'skipped') {
          skippedCount++;
          this.logger.info(`- ${file} skipped: ${result.reason}`);
        }
      } catch (error: any) {
        errorCount++;
        this.logger.error(`✗ ${file} failed: ${error.message}`);
        if (verbose) {
          this.logger.debug(error.stack);
        }
      }
    }

    // Print summary
    this.logger.info('\n=== Import Summary ===');
    this.logger.info(`Total files: ${files.length}`);
    this.logger.info(`Successful: ${successCount}`);
    this.logger.info(`Skipped: ${skippedCount}`);
    this.logger.info(`Failed: ${errorCount}`);

    if (errorCount > 0) {
      throw new Error('Some workflows failed to import');
    }
  }

  private async getFiles(input: string, format: string): Promise<string[]> {
    const fs = require('fs');
    const path = require('path');
    
    const files: string[] = [];

    if (fs.statSync(input).isDirectory()) {
      // Read directory recursively
      const readDir = (dir: string) => {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            readDir(fullPath);
          } else if (this.isWorkflowFile(fullPath, format)) {
            files.push(fullPath);
          }
        }
      };
      
      readDir(input);
    } else {
      // Single file
      if (this.isWorkflowFile(input, format)) {
        files.push(input);
      }
    }

    return files.sort();
  }

  private isWorkflowFile(filePath: string, format: string): boolean {
    const ext = extname(filePath).toLowerCase().substring(1);
    
    if (format === 'json') {
      return ext === 'json';
    } else if (format === 'yaml') {
      return ext === 'yaml' || ext === 'yml';
    }
    
    return ext === format;
  }

  private async processFile(
    filePath: string,
    options: any
  ): Promise<{ status: string; workflow?: any; reason?: string }> {
    const {
      outputDir,
      userId,
      type,
      dryRun,
      verbose,
      overwrite,
      skipValidation
    } = options;

    this.logger.debug(`Processing file: ${filePath}`);

    // Read file
    const fileContent = readFileSync(filePath, 'utf-8');
    let workflowData: any;

    // Parse based on format
    const ext = extname(filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      const yaml = require('yaml');
      workflowData = yaml.parse(fileContent);
    } else {
      workflowData = JSON.parse(fileContent);
    }

    // Validate workflow structure
    if (!skipValidation) {
      const validation = validateWorkflow(workflowData);
      if (!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }
    }

    // Check for existing workflow
    let existingWorkflow = null;
    if (workflowData.id && !overwrite) {
      existingWorkflow = await this.workflowService.getWorkflowById(workflowData.id);
    }

    if (existingWorkflow && !overwrite) {
      return {
        status: 'skipped',
        reason: 'Workflow already exists (use --overwrite to replace)'
      };
    }

    // Prepare workflow data
    const workflow = {
      ...workflowData,
      userId: userId || workflowData.userId || 'system',
      type: type || workflowData.type || 'production',
      version: workflowData.version || 1,
      active: workflowData.active !== undefined ? workflowData.active : true,
      createdAt: workflowData.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Remove ID if overwriting
    if (overwrite && workflow.id) {
      delete workflow.id;
    }

    // Dry run - only validate
    if (dryRun) {
      if (outputDir) {
        // Save processed workflow to output directory
        const outputPath = join(outputDir, basename(filePath));
        writeFileSync(
          outputPath,
          JSON.stringify(workflow, null, 2),
          'utf-8'
        );
      }
      
      return {
        status: 'success',
        workflow
      };
    }

    // Import to database
    const importedWorkflow = existingWorkflow && overwrite
      ? await this.workflowService.updateWorkflow(existingWorkflow.id, workflow)
      : await this.workflowService.createWorkflow(workflow);

    // Create import record
    await this.createImportRecord(filePath, importedWorkflow.id, 'success');

    return {
      status: 'success',
      workflow: importedWorkflow
    };
  }

  private async createImportRecord(
    filePath: string,
    workflowId: string,
    status: string
  ): Promise<void> {
    const importRecord = {
      filePath,
      workflowId,
      status,
      importedAt: new Date(),
      metadata: {
        command: 'import-workflow',
        timestamp: Date.now()
      }
    };

    // Save to imports collection/table
    await this.dbService.saveImportRecord(importRecord);
  }

  // Helper methods for batch operations
  public async importFromArchive(archivePath: string, options: any = {}): Promise<any[]> {
    this.logger.info(`Importing from archive: ${archivePath}`);
    
    const results = [];
    const extractPath = join('/tmp', `extract-${Date.now()}`);
    
    try {
      // Extract archive
      const decompress = require('decompress');
      await decompress(archivePath, extractPath);
      
      // Find workflow files
      const files = await this.getFiles(extractPath, 'json');
      
      // Import each file
      for (const file of files) {
        try {
          const result = await this.processFile(file, {
            ...options,
            dryRun: false
          });
          
          results.push({
            file,
            success: result.status === 'success',
            workflow: result.workflow,
            error: result.status === 'error' ? result.reason : null
          });
        } catch (error: any) {
          results.push({
            file,
            success: false,
            error: error.message
          });
        }
      }
      
      // Cleanup
      const fs = require('fs');
      fs.rmSync(extractPath, { recursive: true, force: true });
      
    } catch (error: any) {
      throw new Error(`Failed to extract archive: ${error.message}`);
    }
    
    return results;
  }

  public async importFromUrl(url: string, options: any = {}): Promise<any> {
    this.logger.info(`Importing from URL: ${url}`);
    
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Download file
      const response = await axios.get(url, {
        responseType: 'stream'
      });
      
      const tempFile = path.join('/tmp', `download-${Date.now()}.json`);
      const writer = fs.createWriteStream(tempFile);
      
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Import downloaded file
      const result = await this.processFile(tempFile, {
        ...options,
        dryRun: false
      });
      
      // Cleanup
      fs.unlinkSync(tempFile);
      
      return result;
      
    } catch (error: any) {
      throw new Error(`Failed to import from URL: ${error.message}`);
    }
  }

  public async importFromDirectory(dirPath: string, options: any = {}): Promise<any[]> {
    this.logger.info(`Importing from directory: ${dirPath}`);
    
    const results = [];
    const files = await this.getFiles(dirPath, options.format || 'json');
    
    for (const file of files) {
      try {
        const result = await this.processFile(file, {
          ...options,
          dryRun: false
        });
        
        results.push({
          file,
          success: result.status === 'success',
          workflow: result.workflow
        });
      } catch (error: any) {
        results.push({
          file,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

// CLI entry point
if (require.main === module) {
  const command = new ImportWorkflowCommand();
  command.execute().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
