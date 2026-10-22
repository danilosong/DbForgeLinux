This page applies to version 0.1.0.

# Integrated Tools

TuxSQL provides a comprehensive suite of database engineering, administration, and modeling tools tailored for developers and database administrators.

Back to the [Main Index](00-index.md).

---

## 1. Schema Compare

**Schema Compare** compares the DDL structure between two live databases or SQL scripts:

- Compares tables, columns, data types, primary and foreign keys, indexes, constraints, views, stored routines (procedures and functions), and triggers.
- Categorizes differences into clear visual groups (Missing, Different, and Additional objects).
- Generates a synchronization DDL deployment script, ready for review and execution against the target database.

Access via **Tools > Schema Compare** or by right-clicking a database in the Database Explorer.

---

## 2. Data Compare

**Data Compare** analyzes table content row by row across databases:

- Uses primary keys or unique indexes to match corresponding rows across tables with the same name.
- Highlights differing records, records missing in the target, and records unique to the source.
- Generates compensatory synchronization scripts containing `INSERT`, `UPDATE`, and `DELETE` statements.

Access via **Tools > Data Compare**.

---

## 3. Query Builder

The **Query Builder** provides a visual canvas for constructing complex SQL queries:

- Drag tables directly from the Database Explorer onto the design surface.
- Establish relational joins (INNER, LEFT, RIGHT JOIN) by connecting corresponding column ports with the mouse.
- Configure selection criteria, sorting (ORDER BY), grouping (GROUP BY), and filters (WHERE and HAVING) through structured grids.
- SQL code updates bi-directionally in real time in the SQL code tab.

Access via **Tools > Query Builder**.

---

## 4. ER Diagram (Entity-Relationship)

The **ER Diagram** tool visualizes the physical data architecture of your database:

- Displays selected tables with their columns, primary keys, indexes, and foreign key constraints.
- Connects tables with relational connectors representing cardinality.
- Offers canvas zoom, panning, automatic card layout reorganization, and diagram export as images or documents.

Access by right-clicking a database in the Database Explorer and choosing **Database Diagram**.

---

## 5. Data Generator

The **Data Generator** populates tables with realistic synthetic test data:

- Includes over 100 domain-specific generators categorized by use case: Personal Identification (IDs, Passports), Names, Addresses, Contacts (Email, Phone), Business (Currencies, Credit Cards, SKUs), IT & Networking (IPs, MAC addresses, UUIDs, Hashes), and Healthcare.
- Preserves referential integrity when populating foreign keys referencing parent tables.
- Safely disables foreign key checks only during the batch generation session, enforcing restoration upon completion.

Access via **Tools > Data Generator**.

---

## 6. Data Import and Export

The data transfer module moves records between formats with ease:

- **Export:** Save tables and query result sets to CSV, JSON, XML, HTML, Markdown, Excel spreadsheets (.xlsx), and SQL INSERT scripts.
- **Import:** Guided wizard for importing data from CSV, JSON, and XML files, featuring visual column mapping, data type conversions, and row error handling.
- **MS Access File Reading (.mdb / .accdb):** Read-only import on Linux through integration with the open-source `mdbtools` utility suite. See installation guidance in [Common Troubleshooting](06-problemas-comuns.md).

Access by right-clicking a table in the Database Explorer and choosing **Import Data...** or **Export Data...**.

---

## 7. Backup and Restore (with systemd and cron Scheduling)

The backup utility performs logical backups of MySQL and MariaDB schemas and tables:

- **Backup Creation:** Exports DDL structure, table data, or both, with compression options and routine/trigger inclusion.
- **Restoration:** Restores schemas and records from `.sql` dump files.
- **Linux Scheduling:** Automatically generates native configuration files to run automated backups via **systemd timers** (`.service` and `.timer` files placed in `~/.config/systemd/user/`) or standard **cron** entries (`crontab -e`), integrating smoothly with native Linux infrastructure.

Access via **Database > Backup...** and **Database > Restore...**.

---

## 8. Documenter

The **Documenter** generates comprehensive technical reports of your database schema:

- Documents schemas, tables, column comments, constraints, relations, views, routines, and user privileges.
- Outputs documentation in standalone **HTML** (with an interactive sidebar search index) and **Markdown** formats.
- Can be run from the UI or via the command-line interface (`tuxsql-doc`) for CI/CD automation pipelines.

Access via **Tools > Documenter**.

---

## 9. Profiler

The **Profiler** inspects execution costs and performance metrics for individual queries:

- Measures granular execution times across internal database processing stages (parsing, opening tables, query optimization, sending data).
- Renders access plans and resource consumption charts to help identify missing indexes and bottlenecks.

Access by toggling the **Enable Profiling** option in the **Query** menu or from the bottom tools panel.

---

## 10. Routine Debugger (Stored Procedure Debugger)

The integrated debugger steps through stored procedures, stored functions, and triggers:

- Set breakpoints on routine source lines.
- Standard execution stepping: Continue (`Alt+F9`), Step Over (`F10`), Step Into (`F11`), and Run to Cursor (`Ctrl+F10`).
- Dedicated inspection panels for local variables and parameters, the call stack, and watched expressions.

*Note:* Debugging requires the `performance_schema` subsystem to be enabled on your MySQL server. See [Common Troubleshooting](06-problemas-comuns.md).

Access by right-clicking a routine in the Database Explorer and choosing **Debug Routine**.

---

## 11. Security Manager, Session Manager, and Server Variables

Core administration utilities for day-to-day server operations:

- **Security Manager (`Ctrl+D Ctrl+Q`):** Manage database user accounts, change passwords, set authentication plugins, and grant or revoke privileges at global, database, and table levels.
- **Session Manager (`Ctrl+D Ctrl+S`):** Monitor active connections in real time. Displays process IDs, connected users, remote host IPs, active databases, query runtimes, and allows terminating unresponsive threads (*Kill Process*).
- **Server Variables (`Ctrl+D Ctrl+V`):** A searchable table of all MySQL/MariaDB system variables, allowing you to inspect and modify supported global and session parameters.

---

## 12. Chart Designer

The **Chart Designer** turns query results into visual charts:

- Open directly from the results grid: right-click any result cell and select **Send to > Chart Designer...**.
- Supports 2D chart families: Bar, Line, Area, Point/Scatter, Pie, Doughnut, Radar, and Polar.
- Visual mapping for arguments, values, and series groups.
- Live preview with export to vector and raster image formats.

---

## 13. Source Control (Git Integration)

The source control module links TuxSQL to local **Git** repositories:

- Connect a Git repository folder containing database scripts and migrations.
- Review modified files, stage changes, commit, switch branches, and push/pull with remote repositories.
- Supports generating individual DDL scripts per database object for granular version tracking.

Access via **File > Open Project...** or via the Project Explorer (`Ctrl+W Ctrl+J`).

---

## 14. Disposable Local Server (Sandbox Docker / Podman)

For safe experiments and isolated testing:

- Spins up a temporary, isolated instance of MySQL or MariaDB inside a local Docker or Podman container with one click.
- Ideal for testing migration scripts, verifying backups, or running benchmarks without impacting shared servers.
- When finished, the container and its temporary data can be destroyed immediately without leaving leftover files on the host system.

Access via the **Disposable Local Server** panel in the activity bar.

---

## 15. Service Control (Linux Service Management)

**Service Control** (`Ctrl+D Ctrl+R`) manages local database daemons directly from the desktop:

- Monitors the status of local system services managed by `systemd` (such as `mysql.service` and `mariadb.service`).
- Allows starting, stopping, restarting, and enabling/disabling services on system boot.
- Requests administrative permissions safely using Linux's native `pkexec` (Polkit) prompt, without running the main TuxSQL process as root.

---

## Next Steps

- View the complete list of hotkeys in [Keyboard Shortcuts](04-atalhos.md).
- Understand the security and permission model in [Security and Privacy](05-seguranca.md).
- Find answers to common technical questions in [Common Troubleshooting](06-problemas-comuns.md).
