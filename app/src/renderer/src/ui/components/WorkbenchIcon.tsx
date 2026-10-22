import type { JSX, ReactNode, SVGProps } from 'react'

export type WorkbenchIconName = 'explorer' | 'assistant' | 'schema' | 'compare' | 'settings' | 'sql' | 'connection' | 'manager' | 'execute' | 'stop' | 'commit' | 'rollback' | 'split' | 'results' | 'theme'

const paths: Record<WorkbenchIconName, ReactNode> = {
  explorer: <><ellipse cx="12" cy="5" rx="7.5" ry="3" /><path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5" /><path d="M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7" /></>,
  assistant: <><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  schema: <><rect x="3.5" y="4" width="7" height="6" rx="1.5" /><rect x="13.5" y="14" width="7" height="6" rx="1.5" /><path d="M10.5 7h3a2 2 0 0 1 2 2v5" /><path d="M7 10v4a2 2 0 0 0 2 2h4.5" /></>,
  compare: <><path d="M4 8h14" /><path d="m14 4 4 4-4 4" /><path d="M20 16H6" /><path d="m10 12-4 4 4 4" /></>,
  settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.4-.5a7.7 7.7 0 0 1-1.5.9l-.2 1.5h-2.5l-.3-1.5a7.7 7.7 0 0 1-1.6-.9l-1.4.5-1.2-2.1 1.2-.9a7.8 7.8 0 0 1 0-1.8l-1.2-.9 1.2-2.1 1.4.5a7.7 7.7 0 0 1 1.6-.9l.3-1.5h2.5l.2 1.5a7.7 7.7 0 0 1 1.5.9l1.4-.5 1.2 2.1-1.2.9a7.8 7.8 0 0 1-.1 1.7Z" transform="translate(-1 -1)" /></>,
  sql: <><path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V3.5Z" /><path d="M14 3.5V8h4M9 12l-2 2 2 2m6-4 2 2-2 2m-2-5-2 6" /></>,
  connection: <><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="m8 8.5 7.5 6.8M18 7v4m-2-2h4" /></>,
  manager: <><ellipse cx="12" cy="5" rx="7.5" ry="3" /><path d="M4.5 5v14c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" /></>,
  execute: <path d="M7 4.5v15L19 12 7 4.5Z" fill="currentColor" stroke="none" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  commit: <><path d="m5 12 4.5 4.5L19 7" /><circle cx="12" cy="12" r="9" /></>,
  rollback: <><path d="M9 7 4 12l5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
  split: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M12 4v16" /></>,
  results: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9h17M9 9v11" /></>,
  theme: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
}

export function WorkbenchIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: WorkbenchIconName }): JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>
}
