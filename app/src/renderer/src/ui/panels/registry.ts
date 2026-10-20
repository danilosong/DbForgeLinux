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
 {id:'import-export',titleKey:'panels.import-export',icon:'⇧',component:ImportexportPanel}
]
