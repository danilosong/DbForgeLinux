export interface KeymapCommand {
  command: string
  shortcut: string
  context: string
}

/** Canonical command and shortcut list collected from the confirmed UX specs. */
export const keymapCommands: readonly KeymapCommand[] = [
  { command: 'New SQL Document', shortcut: 'Ctrl+N', context: 'Global' },
  { command: 'New Connection', shortcut: 'Ctrl+D Ctrl+N', context: 'Global' },
  { command: 'New Connection (alternate)', shortcut: 'Ctrl+Shift+N', context: 'Global' },
  { command: 'Open SQL File', shortcut: 'Ctrl+O', context: 'Global' },
  { command: 'Save SQL', shortcut: 'Ctrl+S', context: 'Editor' },
  { command: 'Save All', shortcut: 'Ctrl+Shift+S', context: 'Global' },
  { command: 'Close Tab', shortcut: 'Ctrl+W', context: 'Editor' },
  { command: 'Exit', shortcut: 'Ctrl+Q', context: 'Global' },
  { command: 'Close All Documents', shortcut: '', context: 'Global' },
  { command: 'Close All But This', shortcut: '', context: 'Global' },
  { command: 'Close All Unmodified', shortcut: '', context: 'Global' },
  { command: 'Show Database Explorer', shortcut: 'Ctrl+W Ctrl+L', context: 'Global' },
  { command: 'Show Output', shortcut: 'Ctrl+W Ctrl+O', context: 'Global' },
  { command: 'Show Error List', shortcut: 'Ctrl+W Ctrl+E', context: 'Global' },
  { command: 'Properties', shortcut: 'F4', context: 'Explorer' },
  { command: 'Toggle Full Screen', shortcut: 'F11', context: 'Global' },
  { command: 'Zoom In', shortcut: 'Ctrl+=', context: 'Global' },
  { command: 'Zoom Out', shortcut: 'Ctrl+-', context: 'Global' },
  { command: 'Reset Zoom', shortcut: 'Ctrl+0', context: 'Global' },
  { command: 'Execute SQL', shortcut: 'F5', context: 'Editor' },
  { command: 'Execute Current Statement', shortcut: 'F8', context: 'Editor' },
  { command: 'Execute Selection', shortcut: 'Ctrl+F8', context: 'Editor' },
  { command: 'Execute To Cursor', shortcut: 'Ctrl+Shift+F10', context: 'Editor' },
  { command: 'Stop Execution', shortcut: 'Shift+F5', context: 'Editor' },
  { command: 'Stop Execution (Alt+Pause)', shortcut: 'Alt+Pause', context: 'Editor' },
  { command: 'Explain Plan', shortcut: 'Ctrl+L', context: 'Editor' },
  { command: 'Toggle Results', shortcut: 'Ctrl+Alt+ArrowDown', context: 'Editor' },
  { command: 'Format Document', shortcut: 'Ctrl+K Ctrl+D', context: 'Editor' },
  { command: 'Toggle Block Comment', shortcut: 'Ctrl+/', context: 'Editor' },
  { command: 'Comment Selection', shortcut: 'Ctrl+K C', context: 'Editor' },
  { command: 'Go To Line', shortcut: 'Ctrl+G', context: 'Editor' },
  { command: 'Find', shortcut: 'Ctrl+F', context: 'Editor' },
  { command: 'Complete', shortcut: 'Ctrl+Space', context: 'Editor' },
  { command: 'Go To Definition', shortcut: 'F12', context: 'Editor' },
  { command: 'Show Find Object', shortcut: 'Ctrl+D Ctrl+F', context: 'Global' },
  { command: 'Options', shortcut: 'Ctrl+,', context: 'Global' },
  { command: 'Show Command Palette', shortcut: 'Ctrl+Shift+P', context: 'Global' },
  { command: 'Show Help', shortcut: 'F1', context: 'Global' },
  { command: 'Execute SQL (F9)', shortcut: 'F9', context: 'Editor' },
  { command: 'Execute SQL (Ctrl+F5)', shortcut: 'Ctrl+F5', context: 'Editor' },
  { command: 'Execute SQL (Ctrl+E)', shortcut: 'Ctrl+E', context: 'Editor' },
  { command: 'Execute SQL (Ctrl+Enter)', shortcut: 'Ctrl+Enter', context: 'Editor' },
  { command: 'Code Analysis', shortcut: 'Ctrl+Alt+A', context: 'Editor' },
  { command: 'Execute Current Statement (F4)', shortcut: 'F4', context: 'Editor' },
  { command: 'Execute Current Statement (Alt+F9)', shortcut: 'Alt+F9', context: 'Editor' },
  { command: 'Format Selection', shortcut: 'Ctrl+K Ctrl+F', context: 'Editor' },
  { command: 'Format Current Statement', shortcut: 'Ctrl+K Ctrl+S', context: 'Editor' },
  { command: 'Run Debugging', shortcut: 'Alt+F9', context: 'Debugger' },
  { command: 'Run Debugging (Ctrl+F5)', shortcut: 'Ctrl+F5', context: 'Debugger' },
  { command: 'Run To Cursor', shortcut: 'Ctrl+F10', context: 'Debugger' },
  { command: 'Run To Cursor (F4)', shortcut: 'F4', context: 'Debugger' },
  { command: 'Restart Debugging', shortcut: 'Shift+F9', context: 'Debugger' },
  { command: 'Compile for Debugging', shortcut: 'Ctrl+Alt+F7', context: 'Debugger' },
  { command: 'Compile Dependants for Debugging', shortcut: 'Ctrl+Alt+F9', context: 'Debugger' },
  { command: 'Compile References for Debugging', shortcut: '', context: 'Debugger' },
  { command: 'Compile Routine', shortcut: 'Ctrl+F7', context: 'Debugger' },
  { command: 'Compile Function', shortcut: 'Ctrl+F9', context: 'Debugger' },
  { command: 'Find in Files', shortcut: 'Ctrl+Shift+F', context: 'Global' },
  { command: 'Replace', shortcut: 'Ctrl+H', context: 'Editor' },
  { command: 'View Start Page', shortcut: 'Ctrl+W Ctrl+S', context: 'Global' },
  { command: 'Show Project Explorer', shortcut: 'Ctrl+W Ctrl+J', context: 'Global' },
  { command: 'Show Schema View', shortcut: 'Ctrl+W Ctrl+C', context: 'Global' },
  { command: 'Show Data Viewer', shortcut: 'Ctrl+W Ctrl+R', context: 'Global' },
  { command: 'Show Document Outline', shortcut: 'Ctrl+W Ctrl+U', context: 'Global' },
  { command: 'Show Code Snippets', shortcut: 'Ctrl+W Ctrl+T', context: 'Global' },
  { command: 'Show Properties', shortcut: 'Ctrl+W Ctrl+P', context: 'Global' },
  { command: 'Show Security Manager', shortcut: 'Ctrl+D Ctrl+Q', context: 'Global' },
  { command: 'Show Session Manager', shortcut: 'Ctrl+D Ctrl+S', context: 'Global' },
  { command: 'Show Server Variables', shortcut: 'Ctrl+D Ctrl+V', context: 'Global' },
  { command: 'Show Service Control', shortcut: 'Ctrl+D Ctrl+R', context: 'Global' },
  { command: 'Format Selection (alternate)', shortcut: '', context: 'Editor' }
  ,{ command: 'Make Uppercase', shortcut: 'Ctrl+Shift+U', context: 'Editor' }
  ,{ command: 'Make Lowercase', shortcut: 'Ctrl+U', context: 'Editor' }
  ,{ command: 'Uncomment Selection', shortcut: 'Ctrl+K U', context: 'Editor' }
  ,{ command: 'Move Selected Lines Up', shortcut: 'Alt+ArrowUp', context: 'Editor' }
  ,{ command: 'Move Selected Lines Down', shortcut: 'Alt+ArrowDown', context: 'Editor' }
  ,{ command: 'Join Lines', shortcut: 'Shift+Alt+L', context: 'Editor' }
  ,{ command: 'Join Lines (alternate)', shortcut: 'Shift+Alt+J', context: 'Editor' }
  ,{ command: 'Incremental Search', shortcut: 'Ctrl+I', context: 'Editor' }
  ,{ command: 'View White Space', shortcut: 'Ctrl+K E', context: 'Editor' }
  ,{ command: 'Word Wrap', shortcut: 'Ctrl+K O', context: 'Editor' }
  ,{ command: 'Add Backticks to All Identifiers', shortcut: 'Ctrl+K Ctrl+[', context: 'Editor' }
  ,{ command: 'Remove Unnecessary Backticks', shortcut: 'Ctrl+K Ctrl+]', context: 'Editor' }
  ,{ command: 'Qualify object names', shortcut: 'Ctrl+K Ctrl+Q', context: 'Editor' }
  ,{ command: 'Expand wildcards', shortcut: 'Ctrl+K Ctrl+Y', context: 'Editor' }
  ,{ command: 'Select Current Statement', shortcut: 'Ctrl+Shift+A', context: 'Editor' }
  ,{ command: 'Execute To Cursor', shortcut: 'Ctrl+Shift+F10', context: 'Editor' }
  ,{ command: 'Run To Cursor', shortcut: 'Ctrl+F10', context: 'Debugger' }
  ,{ command: 'Go To Definition', shortcut: 'F12', context: 'Editor' }
  ,{ command: 'Jump Between Syntax Pairs', shortcut: 'Ctrl+F12', context: 'Editor' }
  ,{ command: 'Rename', shortcut: 'F2', context: 'Editor' }
  ,{ command: 'Insert Snippet', shortcut: 'Ctrl+K X', context: 'Editor' }
  ,{ command: 'List Members', shortcut: 'Ctrl+K L', context: 'Editor' }
  ,{ command: 'Parameter Info', shortcut: 'Ctrl+K P', context: 'Editor' }
  ,{ command: 'Quick Info', shortcut: 'Ctrl+K I', context: 'Editor' }
  ,{ command: 'Complete Word', shortcut: 'Ctrl+K W', context: 'Editor' }
  ,{ command: 'Refresh Suggestions', shortcut: 'Ctrl+Shift+R', context: 'Editor' }
  ,{ command: 'Toggle Bookmark', shortcut: 'Ctrl+B T', context: 'Editor' }
  ,{ command: 'Previous Bookmark', shortcut: 'Ctrl+B P', context: 'Editor' }
  ,{ command: 'Next Bookmark', shortcut: 'Ctrl+B N', context: 'Editor' }
  ,{ command: 'Clear Bookmarks', shortcut: 'Ctrl+B C', context: 'Editor' }
  ,{ command: 'Toggle Outline Expansion', shortcut: 'Ctrl+M M', context: 'Editor' }
  ,{ command: 'Toggle All Outlining', shortcut: 'Ctrl+M L', context: 'Editor' }
  ,{ command: 'Stop Outlining', shortcut: 'Ctrl+M P', context: 'Editor' }
  ,{ command: 'Start Automatic Outlining', shortcut: 'Ctrl+M S', context: 'Editor' }
] as const

export function normalizeKeymapShortcut(value: string): string {
  return value.trim().replace(/\s*\+\s*/g, '+').replace(/\s+/g, ' ').toLowerCase()
}

export function findKeymapConflicts(bindings: readonly KeymapCommand[]): Array<{ shortcut: string; commands: string[] }> {
  const pairs = new Map<string, Set<string>>()
  for (let leftIndex = 0; leftIndex < bindings.length; leftIndex++) {
    const left = bindings[leftIndex]
    const shortcut = normalizeKeymapShortcut(left.shortcut)
    if (!shortcut) continue
    for (const right of bindings.slice(leftIndex + 1)) {
      if (left.command === right.command || normalizeKeymapShortcut(right.shortcut) !== shortcut) continue
      if (left.context !== 'Global' && right.context !== 'Global' && left.context !== right.context) continue
      const commands = pairs.get(shortcut) ?? new Set<string>()
      commands.add(left.command); commands.add(right.command); pairs.set(shortcut, commands)
    }
  }
  return [...pairs.entries()].map(([shortcut, commands]) => ({ shortcut, commands: [...commands] }))
}

