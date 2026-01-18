"use client";

import React from 'react';
import { Folder, FileText, FileCode, File } from 'lucide-react';

interface FileTreeLine {
  raw: string;
  indent: number;
  name: string;
  isFolder: boolean;
  extension?: string;
}

// Extension to color mapping
const extensionColors: Record<string, string> = {
  // Python
  'py': 'var(--accent-amber)',
  'pyi': 'var(--accent-amber)',
  'pyx': 'var(--accent-amber)',
  // JavaScript/TypeScript
  'js': 'var(--accent-amber)',
  'jsx': 'var(--accent-sky)',
  'ts': 'var(--accent-sky)',
  'tsx': 'var(--accent-sky)',
  'mjs': 'var(--accent-amber)',
  // Web
  'html': 'var(--accent-rose)',
  'css': 'var(--accent-violet)',
  'scss': 'var(--accent-violet)',
  'less': 'var(--accent-violet)',
  // Config/Data
  'json': 'var(--accent-amber)',
  'yaml': 'var(--accent-emerald)',
  'yml': 'var(--accent-emerald)',
  'toml': 'var(--accent-emerald)',
  'xml': 'var(--accent-rose)',
  // Markdown/Docs
  'md': 'var(--text-secondary)',
  'mdx': 'var(--text-secondary)',
  'txt': 'var(--text-tertiary)',
  // Shell
  'sh': 'var(--accent-emerald)',
  'bash': 'var(--accent-emerald)',
  'zsh': 'var(--accent-emerald)',
  // Rust
  'rs': 'var(--accent-rose)',
  // Go
  'go': 'var(--accent-cyan)',
  // Ruby
  'rb': 'var(--accent-rose)',
  // Images
  'png': 'var(--accent-violet)',
  'jpg': 'var(--accent-violet)',
  'jpeg': 'var(--accent-violet)',
  'svg': 'var(--accent-amber)',
  'gif': 'var(--accent-violet)',
  'ico': 'var(--accent-violet)',
};

function parseFileTreeLine(line: string): FileTreeLine | null {
  if (!line.trim()) return null;
  
  // Count leading spaces/tree chars for indent level
  const treeChars = /^([\s│├└─\|`\-\+]+)/;
  const match = line.match(treeChars);
  const prefix = match ? match[1] : '';
  
  // Calculate indent (each tree level is typically 2-4 chars)
  const indent = Math.floor(prefix.replace(/[^\s│|]/g, '').length / 2) + 
                 (prefix.match(/[├└\+`]/g) || []).length;
  
  // Extract the actual name
  let name = line.slice(prefix.length).trim();
  
  // Remove trailing / for folders
  const isFolder = name.endsWith('/') || !name.includes('.');
  if (name.endsWith('/')) {
    name = name.slice(0, -1);
  }
  
  // Get extension if file
  const extension = !isFolder && name.includes('.') 
    ? name.split('.').pop()?.toLowerCase() 
    : undefined;
  
  return {
    raw: line,
    indent,
    name,
    isFolder,
    extension,
  };
}

function getFileIcon(line: FileTreeLine) {
  if (line.isFolder) {
    return <Folder className="w-4 h-4 text-[var(--accent-cyan)]" />;
  }
  
  const ext = line.extension;
  if (ext && ['py', 'js', 'jsx', 'ts', 'tsx', 'rs', 'go', 'rb'].includes(ext)) {
    return <FileCode className="w-4 h-4" style={{ color: extensionColors[ext] || 'var(--text-secondary)' }} />;
  }
  
  return <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />;
}

interface FileTreeBlockProps {
  content: string;
  className?: string;
}

export function FileTreeBlock({ content, className = '' }: FileTreeBlockProps) {
  const lines = content.split('\n');
  
  return (
    <div className={`font-mono text-sm ${className}`}>
      {lines.map((line, idx) => {
        const parsed = parseFileTreeLine(line);
        
        if (!parsed) {
          return <div key={idx} className="h-5" />;
        }
        
        // Extract tree chars for display
        const treeChars = /^([\s│├└─\|`\-\+]+)/;
        const match = line.match(treeChars);
        const prefix = match ? match[1] : '';
        
        const nameColor = parsed.isFolder 
          ? 'var(--accent-cyan)' 
          : parsed.extension && extensionColors[parsed.extension]
            ? extensionColors[parsed.extension]
            : 'var(--text-primary)';
        
        return (
          <div 
            key={idx} 
            className="flex items-center h-6 hover:bg-[var(--bg-elevated)] rounded transition-colors group"
          >
            {/* Tree structure characters */}
            <span className="text-[var(--text-tertiary)] whitespace-pre select-none">
              {prefix}
            </span>
            
            {/* Icon */}
            <span className="mr-2 flex-shrink-0 opacity-70 group-hover:opacity-100">
              {getFileIcon(parsed)}
            </span>
            
            {/* Name */}
            <span style={{ color: nameColor }} className="font-medium">
              {parsed.name}
            </span>
            
            {/* Extension badge for certain types */}
            {parsed.extension && ['py', 'ts', 'tsx', 'rs'].includes(parsed.extension) && (
              <span 
                className="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded opacity-50 group-hover:opacity-100"
                style={{ 
                  backgroundColor: `color-mix(in srgb, ${extensionColors[parsed.extension]} 20%, transparent)`,
                  color: extensionColors[parsed.extension] 
                }}
              >
                {parsed.extension.toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper to detect if content looks like a file tree
export function isFileTreeContent(content: string): boolean {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;
  
  // Check for tree characters or consistent folder/file patterns
  const treePattern = /[│├└─\|`\-\+]/;
  const folderPattern = /^\s*[\w\-\.]+\/$/;
  const filePattern = /^\s*[\w\-\.]+\.\w+$/;
  
  let treeCharCount = 0;
  let structureCount = 0;
  
  for (const line of lines) {
    if (treePattern.test(line)) treeCharCount++;
    if (folderPattern.test(line) || filePattern.test(line)) structureCount++;
  }
  
  // If >50% of lines have tree chars, or >70% look like files/folders
  return (treeCharCount / lines.length > 0.5) || (structureCount / lines.length > 0.7);
}
