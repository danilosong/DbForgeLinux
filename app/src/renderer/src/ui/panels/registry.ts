import { createContext, useContext, type ComponentType } from 'react'
import type { ConnectionSummary } from '../../../../shared/contracts.js'
import type { CodeAnalysisFinding } from '../../../../shared/contracts/code-analysis.js'
import SecurityPanel from './security/Panel'
import SessionsPanel from './sessions/Panel'
import ProfilerPanel from './profiler/Panel'
import DatageneratorPanel from './data-generator/Panel'
import DatacomparePanel from './data-compare/Panel'
import DocumenterPanel from './documenter/Panel'
import SchemacomparePanel from './schema-compare/Panel'
import ImportexportPanel from './import-export/Panel'
import QuerybuilderPanel from './query-builder/Panel'
import ERDiagramPanel from './er-diagram/Panel'
import SourceControlPanel from './source-control/Panel'
import DataReportPivotPanel from './data-report-pivot/Panel'
import AiAssistantPanel from './ai-assistant/Panel'
import OptionsPanel from './options/Panel'
import DatabaseToolsPanel from './database-tools/Panel'
import ServiceControlPanel from './service-control/Panel'
import CodeAnalysisPanel from './code-analysis/Panel'
import RoutineDebuggerPanel from './routine-debugger/Panel'
import FindResultsPanel from './find-results/Panel'
import DocumentOutlinePanel from './document-outline/Panel'
import ObjectViewerPanel from './object-viewer/Panel'
import SchemaViewPanel from './schema-view/Panel'
import SchemaUpdatePanel from './schema-update/Panel'
import SnippetsPanel from './snippets/Panel'
import ToolboxPanel from './toolbox/Panel'
import type { DatabaseObject, EditorMetadata } from '../../../../shared/contracts.js'
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

export interface PanelRegistration{id:string;titleKey:string;icon:string;component:ComponentType;presentation?:'document'|'modal'|'dock'}
export const panelRegistry:PanelRegistration[]=[
 {id:'security',titleKey:'panels.security',icon:'◈',component:SecurityPanel},
 {id:'sessions',titleKey:'panels.sessions',icon:'◷',component:SessionsPanel},
 {id:'profiler',titleKey:'panels.profiler',icon:'⌁',component:ProfilerPanel,presentation:'document'},
 {id:'data-generator',titleKey:'panels.data-generator',icon:'✣',component:DatageneratorPanel,presentation:'document'},
 {id:'data-compare',titleKey:'panels.data-compare',icon:'⇄',component:DatacomparePanel,presentation:'document'},
 {id:'documenter',titleKey:'panels.documenter',icon:'▤',component:DocumenterPanel},
 {id:'schema-compare',titleKey:'panels.schema-compare',icon:'⇆',component:SchemacomparePanel,presentation:'document'},
 {id:'er-diagram',titleKey:'panels.er-diagram',icon:'⌘',component:ERDiagramPanel,presentation:'document'},
 {id:'source-control',titleKey:'Source Control Manager',icon:'⑂',component:SourceControlPanel},
 {id:'options',titleKey:'Options...',icon:'⚙',component:OptionsPanel},
 {id:'database-tools',titleKey:'Find Object / Invalid Objects',icon:'⌕',component:DatabaseToolsPanel},
 {id:'service-control',titleKey:'Service Control',icon:'⏻',component:ServiceControlPanel},
 {id:'code-analysis',titleKey:'Code Analysis',icon:'⌁',component:CodeAnalysisPanel},
 {id:'import-export',titleKey:'panels.import-export',icon:'⇧',component:ImportexportPanel},
 {id:'query-builder',titleKey:'panels.Query Builder',icon:'◇',component:QuerybuilderPanel,presentation:'document'},
 {id:'data-report-pivot',titleKey:'report.Data Report / Pivot',icon:'▥',component:DataReportPivotPanel,presentation:'document'},
 {id:'ai-assistant',titleKey:'ai.AI Assistant',icon:'✦',component:AiAssistantPanel,presentation:'dock'},
 {id:'routine-debugger',titleKey:'Routine Debugger',icon:'⏵',component:RoutineDebuggerPanel,presentation:'document'}
 ,{id:'find-results',titleKey:'nav.findResults',icon:'⌕',component:FindResultsPanel,presentation:'document'}
 ,{id:'document-outline',titleKey:'outline.title',icon:'☷',component:DocumentOutlinePanel,presentation:'document'}
 ,{id:'object-viewer',titleKey:'nav.objectViewer',icon:'▤',component:ObjectViewerPanel,presentation:'document'}
 ,{id:'schema-view',titleKey:'nav.schemaView',icon:'◇',component:SchemaViewPanel,presentation:'document'}
 ,{id:'schema-update',titleKey:'extras.schema.title',icon:'⇄',component:SchemaUpdatePanel,presentation:'document'}
 ,{id:'snippets-manager',titleKey:'extras.snippets.title',icon:'❝',component:SnippetsPanel,presentation:'document'}
 ,{id:'toolbox',titleKey:'extras.toolbox.title',icon:'▦',component:ToolboxPanel,presentation:'dock'}
]
