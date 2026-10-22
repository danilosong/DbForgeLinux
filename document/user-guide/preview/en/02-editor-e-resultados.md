This page applies to version 0.1.0.

# SQL Editor and Results Grid

The SQL code editor and the results grid form the operational core of TuxSQL for drafting, executing, and analyzing database queries.

Back to the [Main Index](00-index.md).

---

## Executing SQL Queries

The editor provides multiple execution triggers with granular keyboard control:

- **Execute Entire Script (`F5` or `Ctrl+Enter`):** Sends the entire script content to the active database connection. If text is selected in the editor, only the selected text is executed.
- **Execute Current Statement (`F8`):** Detects the individual bounded SQL statement where the text cursor currently resides and executes it independently, without requiring manual mouse selection.
- **Execute Selection (`Ctrl+F8`):** Strictly executes the highlighted query block.
- **Execute to Cursor (`Ctrl+Shift+F10`):** Runs all statements from the beginning of the document up to the current cursor position.
- **Cancel Query Execution (`Shift+F5` or `Alt+Pause`):** Interrupts an active query running on the remote MySQL/MariaDB server.
- **Explain Plan (`Ctrl+L`):** Generates and displays the execution plan (EXPLAIN tree) showing cost estimates and index usage.

---

## Query History

TuxSQL automatically logs executed queries into a local query history store:

- Records the timestamp, duration in milliseconds, affected or returned row counts, and status code (success or error message).
- Allows searching through past executions and re-inserting previous queries directly into the editor.
- The history is saved locally in your user profile with retention options configurable under **Tools > Options > Documents**.

---

## Results Grid (ResultGrid)

The data grid renders returned rows in a responsive, high-performance tabular view:

- **Null Value Indicators:** NULL values are explicitly labeled with an italicized tag `(null)` to easily distinguish them from empty strings or zero values.
- **Multiple Result Sets:** Multi-statement queries containing multiple `SELECT` statements generate individual tabs in the lower results pane.
- **Status Information Bar:** Displays the total count of returned records, network execution latency in milliseconds, and quick navigation buttons.

---

## Inline Data Editing (Post / Apply / Cancel)

When a query's structure allows, you can modify data cells directly inside the results grid:

### Mandatory Requirement

The queried table **must have a Primary Key or a non-null Unique Index**. If the query originates from complex JOINs, tables lacking a unique identifier, or aggregate calculations, the grid remains in **read-only mode** to prevent ambiguous updates or data corruption.

### Editing Workflow

1. Double-click the cell you wish to change (or focus the cell and press `Enter`).
2. Update the value. The row will be marked with a pending-edit indicator.
3. Use the action buttons on the bottom grid toolbar:
   - **Post:** Validates the modified row and registers it for the active transaction.
   - **Apply (or End Edit):** Commits the changes to the database server.
   - **Cancel:** Reverts pending edits and restores the original row state.

---

## Copying Formatted Data (Copy As)

Right-click on any selected cells, rows, or columns in the grid to export data directly to the clipboard:

- **Copy with Headers (`Ctrl+Shift+C`):** Copies selected tabular data including column names.
- **Copy as CSV:** Formats values with standard comma or semicolon delimiters.
- **Copy as TSV:** Formats values with tab delimiters, ready to paste into spreadsheet applications.
- **Copy as JSON:** Exports selected records as an array of JSON objects.
- **Copy as XML:** Wraps row records into structured XML elements.
- **Copy as Markdown:** Formats selected data into a Markdown table with `|` delimiters.
- **Copy as SQL INSERT:** Generates executable `INSERT INTO table_name (...) VALUES (...);` statements.
- **Copy as SQL UPDATE:** Generates targeted `UPDATE table_name SET ... WHERE primary_key = ...;` statements.

---

## Row Limits and Command Timeouts

To maintain responsiveness and protect system memory:

- **Result Row Limit:** By default, visual queries apply a maximum row ceiling (configurable in **Tools > Options > Execution**). This prevents unintended queries against massive multi-million row tables from exhausting RAM or freezing the UI.
- **Command Timeout:** Defines the maximum duration (in seconds) a query can run before being automatically aborted, protecting your workflow from runaway queries or indefinite table locks. Setting this to `0` disables the timeout.

---

## Next Steps

- Explore specialized database engineering tools in [Integrated Tools](03-ferramentas.md).
- View all navigation and formatting shortcuts in [Keyboard Shortcuts](04-atalhos.md).
- Understand how your data and credentials stay safe in [Security and Privacy](05-seguranca.md).
