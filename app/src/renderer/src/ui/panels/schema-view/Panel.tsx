import { useContext } from 'react'
import { PanelNavigationContext } from '../registry.js'
import { useI18n } from '../../i18n/useI18n.js'

export default function SchemaViewPanel(): React.JSX.Element {
  const { metadata, selectedObject, onSelectSchemaObject } = useContext(PanelNavigationContext)
  const { t } = useI18n()
  const groups = new Map<string, typeof metadata.objects>()
  for (const object of metadata.objects) groups.set(object.kind, [...(groups.get(object.kind) ?? []), object])
  return <section className="navigation-panel"><header><strong>{t('nav.schemaView')}</strong><span>{metadata.database || selectedObject?.database || ''}</span></header>{groups.size || metadata.routines.length ? <div className="schema-overview">{[...groups.entries()].map(([kind, objects]) => <section key={kind}><h3>{kind} ({objects.length})</h3>{objects.map((object) => <button key={`${kind}:${object.name}`} onClick={() => onSelectSchemaObject({ name: object.name, kind: object.kind })}>{object.name}<small>{object.columns.length} {t('nav.columns')}</small></button>)}</section>)}{metadata.routines.length > 0 && <section><h3>{t('nav.routines')} ({metadata.routines.length})</h3>{metadata.routines.map((routine) => <button key={`${routine.kind}:${routine.name}`} onClick={() => onSelectSchemaObject({ name: routine.name, kind: routine.kind })}>{routine.name}<small>{routine.kind}</small></button>)}</section>}</div> : <p>{t('nav.noSchema')}</p>}</section>
}
