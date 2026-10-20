import { createContext, useContext, type ComponentType } from 'react'
import type { ConnectionSummary } from '../../../../shared/contracts.js'
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
export const PanelConnectionContext = createContext<ConnectionSummary | undefined>(undefined)

export function usePanelConnection(): ConnectionSummary | undefined {
 return useContext(PanelConnectionContext)
}

export interface PanelRegistration{id:string;titleKey:string;icon:string;component:ComponentType}
export const panelRegistry:PanelRegistration[]=[
 {id:'security',titleKey:'panels.security',icon:'◈',component:SecurityPanel},
 {id:'sessions',titleKey:'panels.sessions',icon:'◷',component:SessionsPanel},
 {id:'profiler',titleKey:'panels.profiler',icon:'⌁',component:ProfilerPanel},
 {id:'data-generator',titleKey:'panels.data-generator',icon:'✣',component:DatageneratorPanel},
 {id:'data-compare',titleKey:'panels.data-compare',icon:'⇄',component:DatacomparePanel},
 {id:'documenter',titleKey:'panels.documenter',icon:'▤',component:DocumenterPanel},
 {id:'schema-compare',titleKey:'panels.schema-compare',icon:'⇆',component:SchemacomparePanel},
 {id:'er-diagram',titleKey:'panels.er-diagram',icon:'⌘',component:ERDiagramPanel},
 {id:'source-control',titleKey:'Source Control Manager',icon:'⑂',component:SourceControlPanel},
 {id:'options',titleKey:'Options...',icon:'⚙',component:OptionsPanel},
 {id:'database-tools',titleKey:'Find Object / Invalid Objects',icon:'⌕',component:DatabaseToolsPanel},
 {id:'import-export',titleKey:'panels.import-export',icon:'⇧',component:ImportexportPanel},
 {id:'query-builder',titleKey:'panels.Query Builder',icon:'◇',component:QuerybuilderPanel},
 {id:'data-report-pivot',titleKey:'report.Data Report / Pivot',icon:'▥',component:DataReportPivotPanel},
 {id:'ai-assistant',titleKey:'ai.AI Assistant',icon:'✦',component:AiAssistantPanel}
]
