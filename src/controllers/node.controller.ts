import { Request, Response, NextFunction } from 'express';
import { NodeService } from '../core/node/node.service';
import { NodeFactory } from '../core/node/node.factory';
import { Logger } from '../utils/logger';
import { JsonFunctions } from '../json/src/json.functions';
import { DatabaseService } from '../database/database.service';

export class NodeController {
  private nodeService: NodeService;
  private nodeFactory: NodeFactory;
  private logger: Logger;
  private jsonFunctions: JsonFunctions;

  constructor() {
    this.logger = new Logger('NodeController');
    const dbService = new DatabaseService();
    
    this.nodeService = new NodeService(dbService);
    this.nodeFactory = new NodeFactory();
    this.jsonFunctions = new JsonFunctions();
  }

  /**
   * Get all node types
   */
  async getNodeTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        category, 
        version, 
        includeDeprecated = false,
        search
      } = req.query;

      const filters: any = {};
      
      if (category) filters.category = category;
      if (version) filters.version = version;
      if (!includeDeprecated) filters.deprecated = false;
      if (search) filters.search = search as string;

      const nodeTypes = await this.nodeService.getNodeTypes(filters);

      res.json({
        success: true,
        data: nodeTypes,
        count: nodeTypes.length,
        categories: await this.nodeService.getNodeCategories()
      });
    } catch (error: any) {
      this.logger.error('Failed to get node types', error);
      next(error);
    }
  }

  /**
   * Get node type by name
   */
  async getNodeType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { version } = req.query;

      const nodeType = await this.nodeService.getNodeType(type, version as string);

      if (!nodeType) {
        res.status(404).json({
          success: false,
          error: 'Node type not found'
        });
        return;
      }

      res.json({
        success: true,
        data: nodeType
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node type ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get node categories
   */
  async getNodeCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.nodeService.getNodeCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      this.logger.error('Failed to get node categories', error);
      next(error);
    }
  }

  /**
   * Get node parameters schema
   */
  async getNodeParameters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { version } = req.query;

      const parameters = await this.nodeService.getNodeParameters(type, version as string);

      if (!parameters) {
        res.status(404).json({
          success: false,
          error: 'Node parameters not found'
        });
        return;
      }

      res.json({
        success: true,
        data: parameters
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node parameters ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Validate node parameters
   */
  async validateNodeParameters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const parameters = req.body;

      const validation = await this.nodeService.validateNodeParameters(type, parameters);

      res.json({
        success: validation.valid,
        data: validation.data,
        errors: validation.errors,
        warnings: validation.warnings
      });
    } catch (error: any) {
      this.logger.error(`Failed to validate node parameters ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Execute node standalone
   */
  async executeNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { 
        parameters, 
        inputData, 
        credentials,
        nodeVersion
      } = req.body;

      // Create node instance
      const node = this.nodeFactory.createNode(type, {
        parameters: parameters || {},
        credentials: credentials || {},
        version: nodeVersion
      });

      if (!node) {
        res.status(404).json({
          success: false,
          error: `Node type '${type}' not found or cannot be instantiated`
        });
        return;
      }

      // Validate parameters
      const validation = await this.nodeService.validateNodeParameters(type, parameters);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid node parameters',
          details: validation.errors
        });
        return;
      }

      // Execute node
      const startTime = Date.now();
      const result = await node.execute(inputData || {});
      const executionTime = Date.now() - startTime;

      res.json({
        success: result.success !== false,
        data: result.data,
        error: result.error,
        metadata: {
          nodeType: type,
          executionTime,
          nodeVersion: node.getVersion(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      this.logger.error(`Failed to execute node ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get node icon
   */
  async getNodeIcon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      const icon = await this.nodeService.getNodeIcon(type);

      if (!icon) {
        res.status(404).json({
          success: false,
          error: 'Node icon not found'
        });
        return;
      }

      res.setHeader('Content-Type', icon.contentType || 'image/svg+xml');
      res.send(icon.data);
    } catch (error: any) {
      this.logger.error(`Failed to get node icon ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get node documentation
   */
  async getNodeDocumentation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { version } = req.query;

      const docs = await this.nodeService.getNodeDocumentation(type, version as string);

      if (!docs) {
        res.status(404).json({
          success: false,
          error: 'Node documentation not found'
        });
        return;
      }

      res.json({
        success: true,
        data: docs
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node documentation ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get node examples
   */
  async getNodeExamples(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      const examples = await this.nodeService.getNodeExamples(type);

      res.json({
        success: true,
        data: examples
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node examples ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Search nodes
   */
  async searchNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, categories, includeDeprecated = false } = req.query;

      if (!q) {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
        return;
      }

      const results = await this.nodeService.searchNodes(q as string, {
        categories: categories ? (categories as string).split(',') : undefined,
        includeDeprecated: includeDeprecated === 'true'
      });

      res.json({
        success: true,
        data: results,
        query: q
      });
    } catch (error: any) {
      this.logger.error('Failed to search nodes', error);
      next(error);
    }
  }

  /**
   * Get node statistics
   */
  async getNodeStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { period = '30d' } = req.query;

      const stats = await this.nodeService.getNodeStatistics(type, period as string);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node stats ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Register custom node
   */
  async registerCustomNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const nodeDefinition = req.body;

      // Validate node definition
      const validation = this.validateNodeDefinition(nodeDefinition);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid node definition',
          details: validation.errors
        });
        return;
      }

      // Check if node already exists
      const existing = await this.nodeService.getNodeType(nodeDefinition.type);
      if (existing) {
        res.status(409).json({
          success: false,
          error: `Node type '${nodeDefinition.type}' already exists`
        });
        return;
      }

      // Register node
      const registeredNode = await this.nodeService.registerCustomNode(nodeDefinition, userId);

      res.status(201).json({
        success: true,
        data: registeredNode,
        message: 'Custom node registered successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to register custom node', error);
      next(error);
    }
  }

  /**
   * Update custom node
   */
  async updateCustomNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const userId = this.getUserId(req);
      const updateData = req.body;

      // Check if node exists and user has permission
      const existingNode = await this.nodeService.getNodeType(type);
      if (!existingNode) {
        res.status(404).json({
          success: false,
          error: 'Node type not found'
        });
        return;
      }

      if (existingNode.createdBy !== userId && !this.isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to update this node'
        });
        return;
      }

      // Update node
      const updatedNode = await this.nodeService.updateCustomNode(type, updateData);

      res.json({
        success: true,
        data: updatedNode,
        message: 'Custom node updated successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to update custom node ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Delete custom node
   */
  async deleteCustomNode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const userId = this.getUserId(req);

      // Check if node exists and user has permission
      const existingNode = await this.nodeService.getNodeType(type);
      if (!existingNode) {
        res.status(404).json({
          success: false,
          error: 'Node type not found'
        });
        return;
      }

      if (existingNode.createdBy !== userId && !this.isAdmin(req)) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this node'
        });
        return;
      }

      // Delete node
      await this.nodeService.deleteCustomNode(type);

      res.json({
        success: true,
        message: 'Custom node deleted successfully'
      });
    } catch (error: any) {
      this.logger.error(`Failed to delete custom node ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get custom nodes by user
   */
  async getUserCustomNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);

      const nodes = await this.nodeService.getUserCustomNodes(userId);

      res.json({
        success: true,
        data: nodes
      });
    } catch (error: any) {
      this.logger.error('Failed to get user custom nodes', error);
      next(error);
    }
  }

  /**
   * Test node connection
   */
  async testNodeConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;
      const { parameters, credentials } = req.body;

      const connectionTest = await this.nodeService.testNodeConnection(type, {
        parameters,
        credentials
      });

      res.json({
        success: connectionTest.success,
        data: connectionTest.data,
        error: connectionTest.error,
        message: connectionTest.message
      });
    } catch (error: any) {
      this.logger.error(`Failed to test node connection ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Get node changelog
   */
  async getNodeChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      const changelog = await this.nodeService.getNodeChangelog(type);

      res.json({
        success: true,
        data: changelog
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node changelog ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Import nodes from package
   */
  async importNodesFromPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No package file uploaded'
        });
        return;
      }

      // Extract package
      const packageData = await this.extractNodePackage(file.buffer);
      
      // Validate package
      const validation = this.validateNodePackage(packageData);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: 'Invalid node package',
          details: validation.errors
        });
        return;
      }

      // Import nodes
      const results = await this.nodeService.importNodesFromPackage(packageData, userId);

      res.status(201).json({
        success: true,
        data: results,
        message: 'Nodes imported successfully'
      });
    } catch (error: any) {
      this.logger.error('Failed to import nodes from package', error);
      next(error);
    }
  }

  /**
   * Export nodes to package
   */
  async exportNodesToPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeTypes } = req.body;

      if (!nodeTypes || !Array.isArray(nodeTypes)) {
        res.status(400).json({
          success: false,
          error: 'nodeTypes array is required'
        });
        return;
      }

      // Create package
      const packageData = await this.nodeService.exportNodesToPackage(nodeTypes);

      // Create zip file
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="nodes_${Date.now()}.zip"`);

      archive.pipe(res);
      
      // Add package.json
      archive.append(JSON.stringify(packageData.package, null, 2), { name: 'package.json' });
      
      // Add node files
      for (const [filename, content] of Object.entries(packageData.files)) {
        archive.append(typeof content === 'string' ? content : JSON.stringify(content, null, 2), {
          name: filename
        });
      }

      await archive.finalize();
    } catch (error: any) {
      this.logger.error('Failed to export nodes to package', error);
      next(error);
    }
  }

  /**
   * Get node dependencies
   */
  async getNodeDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      const dependencies = await this.nodeService.getNodeDependencies(type);

      res.json({
        success: true,
        data: dependencies
      });
    } catch (error: any) {
      this.logger.error(`Failed to get node dependencies ${req.params.type}`, error);
      next(error);
    }
  }

  /**
   * Install node dependencies
   */
  async installNodeDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      const installation = await this.nodeService.installNodeDependencies(type);

      res.json({
        success: installation.success,
        data: installation.data,
        error: installation.error,
        message: installation.message
      });
    } catch (error: any) {
      this.logger.error(`Failed to install node dependencies ${req.params.type}`, error);
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

  private validateNodeDefinition(definition: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.type) {
      errors.push('Node type is required');
    }

    if (!definition.name) {
      errors.push('Node name is required');
    }

    if (!definition.description) {
      errors.push('Node description is required');
    }

    if (!definition.version) {
      errors.push('Node version is required');
    }

    if (!definition.category) {
      errors.push('Node category is required');
    }

    if (!definition.inputs || !Array.isArray(definition.inputs)) {
      errors.push('Node inputs must be an array');
    }

    if (!definition.outputs || !Array.isArray(definition.outputs)) {
      errors.push('Node outputs must be an array');
    }

    if (!definition.properties || typeof definition.properties !== 'object') {
      errors.push('Node properties must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async extractNodePackage(buffer: Buffer): Promise<any> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    
    const packageEntry = zip.getEntry('package.json');
    if (!packageEntry) {
      throw new Error('Package.json not found in archive');
    }

    const packageJson = JSON.parse(packageEntry.getData().toString('utf-8'));

    // Extract node files
    const files: Record<string, any> = {};
    const entries = zip.getEntries();
    
    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName !== 'package.json') {
        const content = entry.getData().toString('utf-8');
        
        if (entry.entryName.endsWith('.json')) {
          files[entry.entryName] = JSON.parse(content);
        } else {
          files[entry.entryName] = content;
        }
      }
    }

    return {
      package: packageJson,
      files
    };
  }

  private validateNodePackage(packageData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const { package: pkg, files } = packageData;

    if (!pkg) {
      errors.push('Package data is required');
      return { valid: false, errors };
    }

    if (!pkg.name) {
      errors.push('Package name is required');
    }

    if (!pkg.version) {
      errors.push('Package version is required');
    }

    if (!pkg.nodes || !Array.isArray(pkg.nodes)) {
      errors.push('Package must contain nodes array');
    }

    if (pkg.nodes) {
      for (const node of pkg.nodes) {
        const nodeValidation = this.validateNodeDefinition(node);
        if (!nodeValidation.valid) {
          errors.push(`Invalid node definition in package: ${nodeValidation.errors.join(', ')}`);
        }

        // Check if node files exist
        if (node.main && !files[node.main]) {
          errors.push(`Node file not found: ${node.main}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default NodeController;
