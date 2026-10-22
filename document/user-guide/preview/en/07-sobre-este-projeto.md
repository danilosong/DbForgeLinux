This page applies to version 0.1.0.

# About this Project

TuxSQL is an independent, free, and open-source database development and management environment created specifically for the Linux community and database professionals.

Back to the [Main Index](00-index.md).

---

## Scope and Purpose

Many database tools available today were originally developed for other operating systems, relying on heavy emulators or imperfect translation layers when running on Linux.

TuxSQL was built from the ground up as a **first-class Linux desktop citizen**:

- Tailored for the **Debian family** of distributions (Debian GNU/Linux, Ubuntu, Pop!_OS, Linux Mint, and derivatives).
- Natively integrated with Linux desktop standards: Secret Service API keyrings, `systemd` service management, `pkexec` (Polkit) privilege escalation, and full adherence to Linux window tiling and shortcut paradigms.
- Distributed as an optimized native 64-bit (x86_64) package in the `.deb` format.

---

## Open Source License (MIT)

TuxSQL is licensed under the **MIT License**, one of the most permissive and transparent licenses in the open-source ecosystem.

This guarantees:

- Complete freedom to use the software for personal, academic, enterprise, or commercial purposes without royalties.
- Full access to the source code for inspection, modification, and independent security audits.
- No user telemetry, no tracking beacons, and freedom from proprietary lock-in.

---

## Authorship and Community

- **Creator and Maintainer:** Danilo Song.
- **Official Repository:** `https://github.com/danilosong/TuxSQL`
- **Development and Community:** Development takes place openly with contributions and feedback from the Linux open-source community. Bug reports, feature suggestions, and code contributions are welcomed on the official repository.

---

## Third-Party Open Source Components

TuxSQL is built with the help of high-quality open-source projects:

| Component | Role | Open Source License |
| :--- | :--- | :--- |
| **Electron** | Cross-platform desktop runtime powered by Chromium and Node.js | MIT License |
| **React** | Reactive component UI library | MIT License |
| **TypeScript** | Typed language and compiler for software reliability | Apache 2.0 |
| **Monaco Editor** | Code editor with rich syntax highlighting and code completion | MIT License |
| **MySQL2** | High-performance MySQL/MariaDB connection client driver | MIT License |
| **Chart.js** | 2D canvas chart rendering engine | MIT License |

The complete license text for TuxSQL and all third-party software attribution notices can be reviewed in the `LICENSE` file in the official repository or by clicking the **License** button in the **About TuxSQL** dialog (accessible via **Help > About...**).

---

## Documentation Navigation

- [Getting Started and Installation](00-index.md)
- [Connections and SSL/TLS](01-conectar.md)
- [SQL Editor and Results Grid](02-editor-e-resultados.md)
- [Integrated Tools](03-ferramentas.md)
- [Keyboard Shortcuts](04-atalhos.md)
- [Security and Privacy](05-seguranca.md)
- [Common Troubleshooting](06-problemas-comuns.md)
