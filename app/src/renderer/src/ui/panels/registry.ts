import { createContext, lazy, useContext, type ComponentType, type LazyExoticComponent } from 'react'
import type { ConnectionSummary, DatabaseObject, EditorMetadata } from '../../../../shared/contracts.js'
import type { CodeAnalysisFinding } from '../../../../shared/contracts/code-analysis.js'
import type { TextMatch } from '../../modules/navigation/search.js'

export const PanelConnectionContext = createContext<ConnectionSummary | undefined>(undefined)
export const PanelEditorContext = createContext<{ sql: string; onFindings(findings: CodeAnalysisFinding[]): void; insertText?(text: string, snippet?: boolean): void }>({ sql: '', onFindings: () => undefined })
export interface SelectedExplorerObject { connection: ConnectionSummary; database: string; object: DatabaseObject }
export const PanelNavigationContext = createContext<{ matches: Array<TextMatch & { documentId: string; documentLabel: string }>; onNavigate(match: TextMatch & { documentId: string }): void; selectedObject?: SelectedExplorerObject; selectedIntent?: string; onSelectSchemaObject(object: DatabaseObject): void; onOpenObjectViewer(): void; metadata: EditorMetadata }>({ matches: [], onNavigate: () => undefined, onSelectSchemaObject: () => undefined, onOpenObjectViewer: () => undefined, metadata: { database: '', databases: [], objects: [], routines: [] } })

export function usePanelConnection(): ConnectionSummary | undefined {
  return useContext(PanelConnectionContext)
}
export function usePanelNavigation(): { selectedObject?: SelectedExplorerObject; selectedIntent?: string } {
  const { selectedObject, selectedIntent } = useContext(PanelNavigationContext)
  return { selectedObject, selectedIntent }
}

export interface PanelRegistration { id: string; titleKey: string; icon: string; component: LazyExoticComponent<ComponentType>; presentation?: 'document' | 'modal' | 'dock' }
export const panelRegistry: PanelRegistration[] = [
  { id: 'security', titleKey: 'panels.security', icon: '◈', component: lazy(() => import('./security/Panel')) },
  { id: 'sessions', titleKey: 'panels.sessions', icon: '◷', component: lazy(() => import('./sessions/Panel')) },
  { id: 'profiler', titleKey: 'panels.profiler', icon: '⌁', component: lazy(() => import('./profiler/Panel')), presentation: 'document' },
  { id: 'data-generator', titleKey: 'panels.data-generator', icon: '✣', component: lazy(() => import('./data-generator/Panel')), presentation: 'document' },
  { id: 'data-compare', titleKey: 'panels.data-compare', icon: '⇄', component: lazy(() => import('./data-compare/Panel')), presentation: 'document' },
  { id: 'documenter', titleKey: 'panels.documenter', icon: '▤', component: lazy(() => import('./documenter/Panel')), presentation: 'document' },
  { id: 'schema-compare', titleKey: 'panels.schema-compare', icon: '⇆', component: lazy(() => import('./schema-compare/Panel')), presentation: 'document' },
  { id: 'er-diagram', titleKey: 'panels.er-diagram', icon: '⌘', component: lazy(() => import('./er-diagram/Panel')), presentation: 'document' },
  { id: 'source-control', titleKey: 'Source Control Manager', icon: '⑂', component: lazy(() => import('./source-control/Panel')) },
  { id: 'options', titleKey: 'Options...', icon: '⚙', component: lazy(() => import('./options/Panel')) },
  { id: 'database-tools', titleKey: 'Find Object / Invalid Objects', icon: '⌕', component: lazy(() => import('./database-tools/Panel')), presentation: 'document' },
  { id: 'master-detail', titleKey: 'md.browser', icon: '⇄', component: lazy(() => import('./master-detail/Panel')), presentation: 'document' },
  { id: 'copy-databases', titleKey: 'copy.title', icon: '▤', component: lazy(() => import('./copy-databases/Panel')), presentation: 'document' },
  { id: 'service-control', titleKey: 'Service Control', icon: '⏻', component: lazy(() => import('./service-control/Panel')) },
  { id: 'code-analysis', titleKey: 'Code Analysis', icon: '⌁', component: lazy(() => import('./code-analysis/Panel')) },
  { id: 'import-export', titleKey: 'panels.import-export', icon: '⇧', component: lazy(() => import('./import-export/Panel')) },
  { id: 'query-builder', titleKey: 'panels.Query Builder', icon: '◇', component: lazy(() => import('./query-builder/Panel')), presentation: 'document' },
  { id: 'data-report-pivot', titleKey: 'report.Data Report / Pivot', icon: '▥', component: lazy(() => import('./data-report-pivot/Panel')), presentation: 'document' },
  { id: 'ai-assistant', titleKey: 'ai.AI Assistant', icon: '✦', component: lazy(() => import('./ai-assistant/Panel')), presentation: 'dock' },
  { id: 'routine-debugger', titleKey: 'Routine Debugger', icon: '⏵', component: lazy(() => import('./routine-debugger/Panel')), presentation: 'document' },
  { id: 'find-results', titleKey: 'nav.findResults', icon: '⌕', component: lazy(() => import('./find-results/Panel')), presentation: 'document' },
  { id: 'document-outline', titleKey: 'outline.title', icon: '☷', component: lazy(() => import('./document-outline/Panel')), presentation: 'document' },
  { id: 'object-viewer', titleKey: 'nav.objectViewer', icon: '▤', component: lazy(() => import('./object-viewer/Panel')), presentation: 'document' },
  { id: 'schema-view', titleKey: 'nav.schemaView', icon: '◇', component: lazy(() => import('./schema-view/Panel')), presentation: 'document' },
  { id: 'schema-update', titleKey: 'extras.schema.title', icon: '⇄', component: lazy(() => import('./schema-update/Panel')), presentation: 'document' },
  { id: 'snippets-manager', titleKey: 'extras.snippets.title', icon: '❝', component: lazy(() => import('./snippets/Panel')), presentation: 'document' },
  { id: 'toolbox', titleKey: 'extras.toolbox.title', icon: '▦', component: lazy(() => import('./toolbox/Panel')), presentation: 'dock' }
]
