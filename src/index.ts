#!/usr/bin/env bun
import { join, basename } from "path";
import { mkdirSync } from "fs";
import { parseDocument } from "htmlparser2";
import { Element } from "domhandler";
import * as DomUtils from "domutils";

// Types
type ResolveType = 'llm' | 'fetch' | 'passthrough' | 'map';

interface Section {
  title: string;
  content: string;
  resolveType: ResolveType;
  dependencies: string[];
  template?: {
    variables: string[];
  };
  level: number;  // Header level (# = 1, ## = 2, etc.)
  children: Section[];
  parent?: Section;
}

interface ResolvedSection {
  title: string;
  content: string;
  children: ResolvedSection[];
  level: number;
  dependencies: string[];
}

// Parser
class MarkdownParser {
  static parse(markdown: string): Section[] {
    const lines = markdown.split('\n');
    const rootSections: Section[] = [];
    const sectionStack: Section[] = [];
    let currentSection: Section | null = null;
    
    const getCurrentParent = (level: number): Section | null => {
      for (let i = sectionStack.length - 1; i >= 0; i--) {
        if (sectionStack[i].level < level) {
          return sectionStack[i];
        }
      }
      return null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse section headers
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const [title, annotation] = line.split('(#');
        
        const newSection: Section = {
          title: title.replace(/#/g, '').trim(),
          content: '',
          resolveType: annotation ? annotation.replace(')', '').trim() as ResolveType : 'passthrough',
          dependencies: [],
          template: { variables: [] },
          level,
          children: []
        };

        const parent = getCurrentParent(level);
        if (parent) {
          parent.children.push(newSection);
        } else {
          rootSections.push(newSection);
        }

        // Update stack
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }
        sectionStack.push(newSection);
        currentSection = newSection;
        
        continue;
      }
      
      if (currentSection) {
        // Parse content and look for dependencies
        if (line.includes('{{')) {
          const matches = line.match(/{{([^}]+)}}/g) || [];
          currentSection.dependencies = [
            ...currentSection.dependencies,
            ...matches.map(m => m.replace(/[{}]/g, '').trim())
          ];
          if (!currentSection.template) {
            currentSection.template = { variables: [] };
          }
          currentSection.template.variables = [...currentSection.template.variables, ...matches];
        }
        
        currentSection.content += line + '\n';
      }
    }
    
    return rootSections;
  }

  // Helper to get flattened section content including children
  static async getSectionContent(section: Section, resolvedSections: Map<string, string>): Promise<string> {
    let content = section.content;

    // Add resolved content from children, maintaining headers
    for (const child of section.children) {
      const childContent = resolvedSections.get(child.title);
      if (childContent) {
        // Create header marks based on child's level
        const headerMarks = '#'.repeat(child.level);
        content += `\n${headerMarks} ${child.title}\n${childContent}\n`;
      }
    }

    return content.trim();
  }
}

// Resolver
class Resolver {
  private readonly urlPattern = /^https?:\/\/.+/;
  private parser: typeof MarkdownParser;
  private originalSections: Section[];
  private debugDir: string;
  
  constructor(markdown: string, debugDir: string) {
    this.parser = MarkdownParser;
    this.originalSections = MarkdownParser.parse(markdown);
    this.debugDir = debugDir;
  }
  
  private async extractRecipeData(html: string): Promise<string> {
    let output = '';
    
    // Parse HTML and extract JSON-LD data if available
    const dom = parseDocument(html);
    const jsonScripts = DomUtils.findAll(
      (elem): elem is Element => 
        elem instanceof Element && 
        elem.tagName === 'script' && 
        elem.attribs.type === 'application/ld+json',
      dom.children
    );
    
    if (jsonScripts.length > 0) {
      try {
        const jsonText = DomUtils.getText(jsonScripts[0]);
        const jsonData = JSON.parse(jsonText);
        const recipeData = Array.isArray(jsonData) ? jsonData[0] : jsonData;
        output += `JSON-LD Data:\n${JSON.stringify(recipeData, null, 2)}\n\n`;
      } catch (e) {
        console.warn("Failed to parse JSON-LD data:", e);
      }
    }
    
    // Extract plain text using Pandoc
    const proc = Bun.spawn(["pandoc", "-f", "html", "-t", "plain"], {
      stdin: "pipe",
    });
    
    if (!proc.stdin) {
      throw new Error("Failed to get stdin handle for pandoc process");
    }
    
    proc.stdin.write(new TextEncoder().encode(html));
    proc.stdin.flush();
    proc.stdin.end();
    
    const textData = await new Response(proc.stdout).text();
    await proc.exited;
    
    output += `Extracted Text:\n${textData}`;
    
    return output;
  }
  
  async resolveUrl(url: string): Promise<string> {
    const headers = {
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate', 
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    };
    
    const response = await fetch(url, { headers });
    const html = await response.text();
    return await this.extractRecipeData(html);
  }
  
  private formatLLMInput(prompt: string): string {
    // Format similar to bash script
    return prompt;
  }

  async resolveLLM(prompt: string): Promise<string> {
    const formattedPrompt = this.formatLLMInput(prompt);
    console.log("Sending to LLM:", formattedPrompt);
    
    const proc = Bun.spawn(["llm", "-m", "claude-3-5-sonnet-latest"], {
      stdin: "pipe",
      stdio: ["pipe", "pipe", "inherit"]
    });

    if (!proc.stdin) {
      throw new Error("Failed to get stdin handle for llm process");
    }

    // Write to stdin and close it
    proc.stdin.write(new TextEncoder().encode(formattedPrompt));
    proc.stdin.flush();
    proc.stdin.end();

    const text = await new Response(proc.stdout).text();
    await proc.exited;
    if (proc.exitCode !== 0) {
      console.log(proc);
      throw new Error(`LLM command failed with exit code ${proc.exitCode}`);
    }

    return text;
  }
  
  private async resolveMapSection(section: Section, resolvedSections: Map<string, string>): Promise<string> {
    // Find the template variable with #map suffix
    const mapVar = section.template?.variables.find(v => v.includes('#map'));
    if (!mapVar) {
      throw new Error(`Map section ${section.title} requires a template variable with #map suffix`);
    }

    // Extract the section name before #map
    const targetSectionName = mapVar.replace(/[{}]/g, '').split('#')[0].trim();
    
    // Find the target section in the ORIGINAL section tree
    const findSection = (sections: Section[]): Section | undefined => {
      for (const s of sections) {
        if (s.title === targetSectionName) return s;
        const found = findSection(s.children);
        if (found) return found;
      }
      return undefined;
    };

    const targetSection = findSection(this.originalSections);

    if (!targetSection) {
      throw new Error(`Could not find section ${targetSectionName} for mapping`);
    }

    // Process the template once for each child of the target section
    const results = await Promise.all(targetSection.children.map(async childSection => {
      let content = await MarkdownParser.getSectionContent(section, resolvedSections);
      
      // Replace the #map variable with the child's content
      const childContent = resolvedSections.get(childSection.title) || '';
      content = content.replace(mapVar, childContent);
      
      // Replace any other template variables
      if (section.template?.variables) {
        for (const variable of section.template.variables) {
          if (variable === mapVar) continue; // Skip the map variable
          const cleanVar = variable.replace(/[{}]/g, '').trim();
          const replacement = resolvedSections.get(cleanVar) || '';
          content = content.replace(variable, replacement);
        }
      }

      return await this.resolveLLM(content);
    }));

    // Combine all results
    return results.join('\n\n');
  }

  async resolveSection(section: Section, resolvedSections: Map<string, ResolvedSection>): Promise<string> {
    console.log(`\nResolving section: ${section.title}`);
    console.log(`Dependencies:`, section.dependencies);
    
    // Debug logging of input state
    const debugInput = {
      section: {
        title: section.title,
        content: section.content,
        resolveType: section.resolveType,
        dependencies: section.dependencies,
        template: section.template
      },
      resolvedDependencies: Object.fromEntries(
        section.dependencies.map(dep => {
          const baseDep = dep.split('#')[0];
          const resolvedSection = resolvedSections.get(baseDep);
          console.log(`\nProcessing dependency ${baseDep}:`);
          console.log(`- Found resolved section:`, !!resolvedSection);
          if (resolvedSection) {
            console.log(`- Number of children:`, resolvedSection.children.length);
            console.log(`- Children titles:`, resolvedSection.children.map(c => c.title));
          }
          
          if (!resolvedSection) return [dep, null];
          
          // Combine parent and children content for the dependency
          const allContent = [
            resolvedSection.content,
            ...resolvedSection.children.map(child => child.content)
          ].filter(Boolean);
          
          const combined = allContent.join('\n\n');
          console.log(`- Combined content length:`, combined.length);
          console.log(`- Content preview:`, combined.slice(0, 100));
          console.log('All', resolvedSection)
          
          return [dep, combined];
        })
      )
    };
    
    // Write debug input to file
    const debugPath = join(this.debugDir, `${section.title.toLowerCase()}-input.json`);
    await Bun.write(debugPath, JSON.stringify(debugInput, null, 2));

    let content = section.content;
    
    // Check for #foreach variables before other processing
    if (section.template?.variables) {
      const foreachVar = section.template.variables.find(v => v.includes('#foreach'));
      if (foreachVar) {
        return await this.resolveForeachSection(section, foreachVar, resolvedSections);
      }

      // Regular template variable replacement continues as before...
      for (const variable of section.template.variables) {
        const cleanVar = variable.replace(/[{}]/g, '').trim();
        const resolvedSection = resolvedSections.get(cleanVar.split('#')[0]);
        
        if (resolvedSection) {
          const allContent = [
            resolvedSection.content,
            ...resolvedSection.children.map(child => child.content)
          ].filter(Boolean);
          
          const replacement = allContent.join('\n\n');
          content = content.replace(variable, replacement);
        }
      }
    }
    
    // Apply resolution based on type
    switch (section.resolveType) {
      case 'fetch':
        if (this.urlPattern.test(content.trim())) {
          return await this.resolveUrl(content.trim());
        }
        return content;
        
      case 'passthrough':
        return content;
        
      case 'llm':
        return await this.resolveLLM(content);
        
      default:
        return content;
    }
  }

  async resolveForeachSection(
    section: Section, 
    foreachVar: string, 
    resolvedSections: Map<string, ResolvedSection>
  ): Promise<string> {
    const targetSectionName = foreachVar.replace(/[{}]/g, '').split('#')[0].trim();
    const targetSection = resolvedSections.get(targetSectionName);
    
    if (!targetSection) {
      throw new Error(`Could not find section ${targetSectionName} for foreach operation`);
    }

    // Process template for each child
    const results = await Promise.all(targetSection.children.map(async childSection => {
      let content = section.content;
      
      // Replace the #foreach variable with child's content
      content = content.replace(foreachVar, childSection.content || '');
      
      // Replace other template variables
      if (section.template?.variables) {
        for (const variable of section.template.variables) {
          if (variable === foreachVar) continue;
          const cleanVar = variable.replace(/[{}]/g, '').trim();
          const resolvedSection = resolvedSections.get(cleanVar);
          const replacement = resolvedSection?.content || '';
          content = content.replace(variable, replacement);
        }
      }

      return await this.resolveLLM(content);
    }));

    return results.join('\n\n');
  }
}

// Processor
class MarkdownProcessor {
  private parser: typeof MarkdownParser;
  private resolver!: Resolver;  // Use definite assignment assertion
  private debugDir: string;
  private outputDir: string;
  private resolvedSections = new Map<string, ResolvedSection>();
  
  constructor(inputFile: string) {
    this.parser = MarkdownParser;
    
    const baseDir = basename(inputFile, ".md");
    this.debugDir = join("output", baseDir, "debug");
    this.outputDir = join("output", baseDir);
    
    // Create directories
    mkdirSync(this.debugDir, { recursive: true });
    mkdirSync(this.outputDir, { recursive: true });
  }

  private async flattenSections(sections: Section[]): Promise<Section[]> {
    const flattened: Section[] = [];
    
    const addSection = (section: Section, parent?: Section) => {
      // Set parent relationship
      if (parent) {
        section.parent = parent;
      }
      
      // Add section to flattened list
      flattened.push(section);
      
      // Process children
      section.children.forEach(child => {
        addSection(child, section);
      });
    };
    
    sections.forEach(section => addSection(section));
    return flattened;
  }
  
  private async generateRootDocument(sections: Section[]): Promise<string> {
    let content = '';
    
    // Process each root-level section
    for (const section of sections) {
      const resolvedSection = this.resolvedSections.get(section.title);
      if (resolvedSection) {
        // Add header
        content += `${'#'.repeat(section.level)} ${section.title}\n\n`;
        // Add content
        content += `${resolvedSection.content}\n\n`;
        
        // Add children content with proper header levels
        for (const child of resolvedSection.children) {
          content += `${'#'.repeat(child.level)} ${child.title}\n\n`;
          content += `${child.content}\n\n`;
        }
      }
    }
    
    return content.trim();
  }

  async process(markdown: string): Promise<Map<string, ResolvedSection>> {
    this.resolver = new Resolver(markdown, this.debugDir);
    
    const sections = this.parser.parse(markdown);
    const allSections = await this.flattenSections(sections);
    
    // Build dependency graph (without parent dependencies)
    const graph = new Map<string, string[]>();
    const inProgress = new Set<string>();  // Track sections being resolved
    
    for (const section of allSections) {
      graph.set(section.title, [...section.dependencies]);
    }
    
    const resolveSection = async (title: string): Promise<void> => {
      // Skip if already resolved or in progress
      if (this.resolvedSections.has(title) || inProgress.has(title)) {
        console.log(`✓ Skipping ${title} (already resolved or in progress)`);
        return;
      }
      
      const outputPath = join(this.outputDir, `${title.toLowerCase()}.md`);
      console.log(`⏳ Starting ${title} -> ${outputPath}`);
      inProgress.add(title);
      
      const section = allSections.find(s => s.title === title);
      if (!section) {
        inProgress.delete(title);
        return;
      }
      
      try {
        // First resolve all explicit dependencies
        const deps = graph.get(title) || [];
        for (const dep of deps) {
          await resolveSection(dep);
        }

        // Then resolve all children sequentially
        for (const child of section.children) {
          await resolveSection(child.title);
        }
        
        // Now resolve the section itself
        const resolvedContent = await this.resolver.resolveSection(section, this.resolvedSections);
        
        // Create resolved section with hierarchy and store it
        const resolvedSection: ResolvedSection = {
          title: section.title,
          content: resolvedContent,
          children: section.children
            .map(child => this.resolvedSections.get(child.title))
            .filter((child): child is ResolvedSection => child !== undefined),
          level: section.level,
          dependencies: section.dependencies
        };
        
        this.resolvedSections.set(title, resolvedSection);
        
        // Write output files immediately after resolution
        await this.writeOutputFiles(resolvedSection);
        
        console.log(`✓ Completed ${title} -> ${outputPath}`);
      } finally {
        inProgress.delete(title);
      }
    };
    
    // Process sections sequentially, starting from the root
    for (const section of sections) {
      await resolveSection(section.title);
    }
    
    // After processing all sections, generate and write root document
    const rootContent = await this.generateRootDocument(sections);
    const rootFilename = join(this.outputDir, `${sections[0].title.toLowerCase()}.md`);
    await Bun.write(rootFilename, rootContent);
    
    return this.resolvedSections;
  }

  private async writeOutputFiles(section: ResolvedSection) {
    // Write debug input
    const debugInput = {
      section,
      resolvedDependencies: Object.fromEntries(
        [...this.resolvedSections.entries()]
          .filter(([key]) => section.dependencies?.includes(key))
      )
    };
    
    await Bun.write(
      join(this.debugDir, `${section.title.toLowerCase()}-input.json`),
      JSON.stringify(debugInput, null, 2)
    );
    
    // Write content
    await Bun.write(
      join(this.outputDir, `${section.title.toLowerCase()}.md`),
      section.content
    );
  }
}

// Main program
async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error("Usage: bun run processor.ts <input-markdown-file>");
    process.exit(1);
  }

  try {
    const markdown = await Bun.file(inputFile).text();
    const processor = new MarkdownProcessor(inputFile);
    await processor.process(markdown);
    console.log("Processing complete!");
  } catch (error) {
    console.error("Processing failed:", error);
    process.exit(1);
  }
}

main();
