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
  resolveType: ResolveType;
  dependencies: string[];
  template?: {
    variables: string[];
  };
  level: number;  // Header level (# = 1, ## = 2, etc.)
  children: Section[];
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
          currentSection.template = {
            variables: [...currentSection.template.variables, ...matches]
          };
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
    proc.stdin.close();
    
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
    proc.stdin.close();

    const text = await new Response(proc.stdout).text();
    await proc.exited;
    if (proc.exitCode !== 0) {
      console.log(proc);
      throw new Error(`LLM command failed with exit code ${proc.exitCode}`);
    }

    return text;
  }
  
  async resolveSection(section: Section, resolvedSections: Map<string, string>): Promise<string> {
    let content = await MarkdownParser.getSectionContent(section, resolvedSections);
    
    // Replace template variables
    if (section.template?.variables) {
      for (const variable of section.template.variables) {
        const cleanVar = variable.replace(/[{}]/g, '').trim();
        const replacement = resolvedSections.get(cleanVar) || '';
        content = content.replace(variable, replacement);
      }
    }
    
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
}

// Processor
class MarkdownProcessor {
  private parser: typeof MarkdownParser;
  private resolver: Resolver;
  private debugDir: string;
  private outputDir: string;
  
  constructor(inputFile: string) {
    this.parser = MarkdownParser;
    this.resolver = new Resolver();
    
    const baseDir = basename(inputFile, ".md");
    this.debugDir = join("output", baseDir, "debug");
    this.outputDir = join("output", baseDir);
    
    // Create directories
    mkdirSync(this.debugDir, { recursive: true });
    mkdirSync(this.outputDir, { recursive: true });
  }

  private async flattenSections(sections: Section[]): Promise<Section[]> {
    const flattened: Section[] = [];
    
    const flatten = (section: Section) => {
      flattened.push(section);
      section.children.forEach(flatten);
    };
    
    sections.forEach(flatten);
    return flattened;
  }
  
  async process(markdown: string): Promise<Map<string, string>> {
    const sections = this.parser.parse(markdown);
    console.log("Parsed sections:", JSON.stringify(sections, null, 2));

    const resolvedSections = new Map<string, string>();
    const allSections = await this.flattenSections(sections);
    
    // Build dependency graph
    const graph = new Map<string, string[]>();
    for (const section of allSections) {
      graph.set(section.title, section.dependencies);
    }
    
    // Resolve sections in dependency order
    const resolved = new Set<string>();
    
    const resolveSection = async (title: string) => {
      if (resolved.has(title)) return;
      
      const section = allSections.find(s => s.title === title);
      if (!section) return;
      
      // Resolve dependencies first
      const deps = graph.get(title) || [];
      for (const dep of deps) {
        await resolveSection(dep);
      }

      // Resolve children first
      for (const child of section.children) {
        await resolveSection(child.title);
      }
      
      // Write debug input file
      const debugInput = {
        section,
        resolvedDependencies: Object.fromEntries(
          [...resolvedSections.entries()]
            .filter(([key]) => section.dependencies.includes(key))
        )
      };
      await Bun.write(
        join(this.debugDir, `${section.title.toLowerCase()}-input.json`),
        JSON.stringify(debugInput, null, 2)
      );
      
      // Resolve section
      const resolvedContent = await this.resolver.resolveSection(section, resolvedSections);
      
      // Write output immediately
      await Bun.write(
        join(this.outputDir, `${section.title.toLowerCase()}.md`),
        resolvedContent
      );
      
      resolvedSections.set(title, resolvedContent);
      resolved.add(title);
      
      console.log(`✓ Resolved ${title}`);
    };
    
    // Resolve all sections
    for (const section of allSections) {
      await resolveSection(section.title);
    }
    
    return resolvedSections;
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
