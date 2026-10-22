This page applies to version 0.1.0.

# Keyboard Shortcuts

TuxSQL provides full keyboard-driven navigation and operations. All shortcuts listed on this page are confirmed in the application codebase and can be customized under **Tools > Options > Keyboard** (`Ctrl+,`).

Back to the [Main Index](00-index.md).

---

## Global Navigation Commands

These shortcuts work across the entire application:

| Command | Default Shortcut | Context |
| :--- | :--- | :--- |
| New SQL Document | `Ctrl+N` | Global |
| New Connection | `Ctrl+D Ctrl+N` or `Ctrl+Shift+N` | Global |
| Open SQL File | `Ctrl+O` | Global |
| Save All Documents | `Ctrl+Shift+S` | Global |
| Exit Application | `Ctrl+Q` | Global |
| Show Command Palette | `Ctrl+Shift+P` | Global |
| Options and Preferences | `Ctrl+,` | Global |
| Help and Documentation | `F1` | Global |
| Toggle Full Screen | `F11` | Global |
| Zoom In Interface | `Ctrl+=` | Global |
| Zoom Out Interface | `Ctrl+-` | Global |
| Reset Interface Zoom | `Ctrl+0` | Global |
| Show Database Explorer | `Ctrl+W Ctrl+L` | Global |
| Show Output Panel | `Ctrl+W Ctrl+O` | Global |
| Show Error List | `Ctrl+W Ctrl+E` | Global |
| View Start Page | `Ctrl+W Ctrl+S` | Global |
| Show Project Explorer | `Ctrl+W Ctrl+J` | Global |
| Show Document Outline | `Ctrl+W Ctrl+U` | Global |
| Show Code Snippets | `Ctrl+W Ctrl+T` | Global |
| Show Properties Panel | `Ctrl+W Ctrl+P` | Global |
| Find in Files | `Ctrl+Shift+F` | Global |
| Find Database Object | `Ctrl+D Ctrl+F` | Global |
| Show Security Manager | `Ctrl+D Ctrl+Q` | Global |
| Show Session Manager | `Ctrl+D Ctrl+S` | Global |
| Show Server Variables | `Ctrl+D Ctrl+V` | Global |
| Show Service Control | `Ctrl+D Ctrl+R` | Global |

---

## SQL Editor and Execution

Shortcuts active while writing or executing SQL queries:

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Execute SQL** | `F5` or `Ctrl+Enter` | Executes the entire script or current selection. |
| **Execute Current Statement** | `F8` | Runs only the bounded statement under the cursor. |
| **Execute Selection** | `Ctrl+F8` | Executes only the highlighted text. |
| **Execute to Cursor** | `Ctrl+Shift+F10` | Runs statements from the beginning up to the cursor position. |
| **Stop Execution** | `Shift+F5` or `Alt+Pause` | Cancels the active query on the server. |
| **Explain Plan** | `Ctrl+L` | Generates the execution plan tree for the query. |
| **Toggle Results** | `Ctrl+Alt+ArrowDown` | Hides or reveals the bottom results pane. |
| **Save Document** | `Ctrl+S` | Saves the open document to disk. |
| **Close Tab** | `Ctrl+W` | Closes the active document tab. |
| **Format Document** | `Ctrl+K Ctrl+D` | Formats all code according to the active profile. |
| **Format Selection** | `Ctrl+K Ctrl+F` | Formats only the selected lines. |
| **Format Current Statement** | `Ctrl+K Ctrl+S` | Formats the single SQL statement under the cursor. |
| **Toggle Block Comment** | `Ctrl+/` | Comments or uncomments lines with `--` or `/* ... */`. |
| **Comment Selection** | `Ctrl+K C` | Marks the selected lines as comments. |
| **Uncomment Selection** | `Ctrl+K U` | Removes comment delimiters from the selection. |
| **Code Completion (IntelliSense)** | `Ctrl+Space` | Opens completion proposals for keywords and identifiers. |
| **Go To Line** | `Ctrl+G` | Jumps directly to a specific line number. |
| **Find in Editor** | `Ctrl+F` | Opens the search bar inside the code editor. |
| **Replace in Editor** | `Ctrl+H` | Opens the search and replace bar. |
| **Go To Definition** | `F12` | Navigates to the declaration of the object under cursor. |
| **Jump Syntax Pairs** | `Ctrl+F12` | Jumps between matching brackets or parentheses. |
| **Rename Identifier** | `F2` | Contextual rename for symbols or aliases. |
| **Make Uppercase** | `Ctrl+Shift+U` | Converts the selection to uppercase letters. |
| **Make Lowercase** | `Ctrl+U` | Converts the selection to lowercase letters. |
| **Move Line Up** | `Alt+ArrowUp` | Moves the current line up by one line. |
| **Move Line Down** | `Alt+ArrowDown` | Moves the current line down by one line. |
| **Add Backticks to Identifiers** | `Ctrl+K Ctrl+[` | Wraps table and column names in backticks (`` `name` ``). |
| **Remove Unnecessary Backticks** | `Ctrl+K Ctrl+]` | Strips backticks from unreserved identifiers. |
| **Qualify Object Names** | `Ctrl+K Ctrl+Q` | Prepends the schema prefix (`database.table`). |
| **Expand Wildcards (`*`)** | `Ctrl+K Ctrl+Y` | Replaces `*` with the explicit list of table columns. |
| **Select Current Statement** | `Ctrl+Shift+A` | Selects the full bounded SQL statement text. |

---

## Editor Bookmarks

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Toggle Bookmark** | `Ctrl+B T` | Sets or removes a bookmark on the active line. |
| **Next Bookmark** | `Ctrl+B N` | Jumps to the next bookmark downward. |
| **Previous Bookmark** | `Ctrl+B P` | Jumps to the previous bookmark upward. |
| **Clear All Bookmarks** | `Ctrl+B C` | Clears all bookmarks in the active file. |

---

## Routine Debugger

Shortcuts active inside the stored procedure and trigger debugger:

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Run / Continue Debugging** | `Alt+F9` or `Ctrl+F5` | Starts the session or steps to the next breakpoint. |
| **Run to Cursor** | `Ctrl+F10` or `F4` | Continues execution and pauses at the cursor line. |
| **Restart Debugging** | `Shift+F9` | Restarts the routine from the initial instruction. |
| **Compile for Debugging** | `Ctrl+Alt+F7` | Instruments the routine to enable breakpoints. |
| **Compile Dependants** | `Ctrl+Alt+F9` | Prepares dependent routines for inter-routine debugging. |
| **Compile Routine** | `Ctrl+F7` | Compiles the active stored procedure. |
| **Compile Function** | `Ctrl+F9` | Compiles the active stored function. |

---

## Database Explorer

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Properties** | `F4` | Opens the properties inspector for the selected database object. |

---

## Customizing Key Bindings

You can modify any keyboard shortcut or select a different key scheme under **Tools > Options > Keyboard**:

1. Select the command you want to change.
2. Focus the key input box.
3. Press your desired key combination.
4. TuxSQL detects potential shortcut collisions with existing commands before saving.

---

## Next Steps

- Review our security architecture in [Security and Privacy](05-seguranca.md).
- Resolve troubleshooting issues in [Common Troubleshooting](06-problemas-comuns.md).
- Read about the open-source project in [About this Project](07-sobre-este-projeto.md).
