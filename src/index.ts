#!/usr/bin/env bun
import { join, basename } from "path";
import { mkdirSync } from "fs";
import { parseDocument } from "htmlparser2";
import { Element } from "domhandler";
import * as DomUtils from "domutils";

// Types
type ResolveType = 'llm' | 'fetch' | 'passthrough';

interface Section {
  title: string;
  content: string;
  resolution: {
    type: ResolveType;
    perChild: boolean;
  };
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
  content: string[];
  children: ResolvedSection[];
  level: number;
  dependencies: string[];

}

// Parser becomes a pure function module
class Parser {
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
        
        const resolveType = annotation ? 
          annotation.replace(')', '').split(' ')[0].trim() as ResolveType : 
          'passthrough';
        
        const perChild = annotation ? 
          annotation.includes('per-child') : 
          false;

        const newSection: Section = {
          title: title.replace(/#/g, '').trim(),
          content: '',
          resolution: {
            type: resolveType,
            perChild
          },
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
    
    console.log("Sections ParseD", rootSections);
    return rootSections;
  }

}

class Resolver {
  private readonly urlPattern = /^https?:\/\/.+/;
  private resolvedSections = new Map<string, ResolvedSection>();

  async resolve(sections: Section[]): Promise<Map<string, ResolvedSection>> {
    // Process sections in dependency order
    for (const section of sections) {
      
      // Recursively resolve children
      if (section.children.length > 0) {
        await this.resolve(section.children);
      }
      await this.resolveSection(section);
    }
    
    return this.resolvedSections;
  }

  private parsePerVariables(content: string): { variableName: string, isPerVariable: boolean }[] {
    const varRegex = /{{([^}]+?)(#per)?}}/g;
    const variables: { variableName: string, isPerVariable: boolean }[] = [];
    
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      variables.push({
        variableName: match[1],
        isPerVariable: match[2] === '#per'
      });
    }
    return variables;
  }

  private async resolveSection(section: Section): Promise<void> {
    if (this.resolvedSections.has(section.title)) {
      return;
    }

    // Parse variables to identify #per variables
    const variables = this.parsePerVariables(section.content);
    
    // Ensure all dependencies are resolved first (strip #per suffix when checking)
    for (const variable of variables) {
      const depName = variable.variableName; // Already parsed without #per suffix
      if (!this.resolvedSections.has(depName)) {
        throw new Error(`Unresolved dependency: ${depName} for section: ${section.title}`);
      }
    }

    const resolvedChildren = section.children.map(child => 
      this.resolvedSections.get(child.title)
    ).filter((child): child is ResolvedSection => child !== undefined);

    // Determine if we need multiple processing groups from #per variables
    const perVariable = variables.find(v => v.isPerVariable);
    
    // Create processing groups based on either perChild or perVariable
    let processingGroups: Array<{
      children: ResolvedSection[],
      varContent?: string
    }> = [];

    if (perVariable) {
      const resolvedVar = this.resolvedSections.get(perVariable.variableName);
      if (!resolvedVar) {
        throw new Error(`Unresolved per-variable dependency: ${perVariable.variableName}`);
      }
      // Create a processing group for each content item in the per-variable section
      processingGroups = resolvedVar.content.map(varContent => ({
        children: resolvedChildren,
        varContent
      }));
    } else if (section.resolution.perChild) {
      processingGroups = resolvedChildren.map(child => ({
        children: [child]
      }));
    } else {
      processingGroups = [{
        children: resolvedChildren
      }];
    }

    const content: string[] = await Promise.all(processingGroups.map(async group => {
      let combinedContent = section.content;
      
      // Replace per-variable if present
      if (perVariable && group.varContent) {
        combinedContent = combinedContent.replace(
          new RegExp(`{{${perVariable.variableName}#per}}`, 'g'),
          group.varContent
        );
      }

      // Add children content
      for (const child of group.children) {
        const headerMarkers = '#'.repeat(child.level);
        combinedContent += `\n${headerMarkers} ${child.title}\n${child.content.join('\n')}`;
      }

      // Replace regular variables
      for (const variable of variables.filter(v => !v.isPerVariable)) {
        const resolvedDep = this.resolvedSections.get(variable.variableName);
        if (resolvedDep) {
          combinedContent = combinedContent.replace(
            new RegExp(`{{${variable.variableName}}}`, 'g'),
            resolvedDep.content.join('\n')
          );
        }
      }

      return await this.resolveContent(combinedContent, section.resolution.type);
    }));

    this.resolvedSections.set(section.title, {
      title: section.title,
      content,
      children: resolvedChildren,
      level: section.level,
      dependencies: section.dependencies
    });
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
  
  async resolveLLM(prompt: string): Promise<string> {
    const formattedPrompt = prompt;
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
  
  private async resolveContent(content: string, resolutionType: ResolveType): Promise<string> {
    switch (resolutionType) {
      case 'fetch': {
        const urls = content.trim().split('\n');
        const fetchedContents: string[] = [];
        for (const url of urls) {
          if (this.urlPattern.test(url)) {
            const fetchedContent = await this.resolveUrl(url);
            fetchedContents.push(fetchedContent);
          }
        }
        return fetchedContents.join('\n');
      }
      case 'llm': {
        return await this.resolveLLM(content);
      }
      case 'passthrough':
      default:
        return content;
    }
  }
}

// New Processor class handles all file I/O
class Processor {
  private readonly inputFile: string;
  private readonly debugDir: string;
  private readonly outputDir: string;
  private readonly resolver: Resolver;

  constructor(inputFile: string) {
    this.inputFile = inputFile;
    const baseDir = basename(inputFile, ".md");
    this.debugDir = join("output", baseDir, "debug");
    this.outputDir = join("output", baseDir);
    
    // Create directories
    mkdirSync(this.debugDir, { recursive: true });
    mkdirSync(this.outputDir, { recursive: true });
    
    this.resolver = new Resolver();
  }

  private async writeOutputFiles(section: ResolvedSection): Promise<void> {
    // Create markdown content from the section
    const content = this.formatSectionAsMarkdown(section) + "\n\n---\n# Source\n\n```json\n" + JSON.stringify(section, null, 2) + "\n```";
    
    // Write to file
    await Bun.write(
      join(this.outputDir, `${section.title.toLowerCase()}.md`),
      content
    );
  }

  private formatSectionAsMarkdown(section: ResolvedSection): string {
    let markdown = `# ${section.title}\n\n`;
    markdown += section.content.join('\n\n');
    return markdown;
  }

  async process(): Promise<void> {
    const markdown = await Bun.file(this.inputFile).text();
    const sections = Parser.parse(markdown);
    const resolvedSections = await this.resolver.resolve(sections);
    
    // Write output files
    for (const section of resolvedSections.values()) {
      await this.writeOutputFiles(section);
    }
  }
}

// Main program becomes simpler
async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error("Usage: bun run processor.ts <input-markdown-file>");
    process.exit(1);
  }

  try {
    const processor = new Processor(inputFile);
    await processor.process();
    console.log("Processing complete!");
  } catch (error) {
    console.error("Processing failed:", error);
    process.exit(1);
  }
}

main();
