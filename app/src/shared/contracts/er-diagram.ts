import type { ERDiagram, DiagramRelation } from '../../modules/er-diagram/types.js'
export interface ERDiagramApi {
  loadERDiagram(activeConnectionId: string, database: string, connectionId: string): Promise<ERDiagram>
  saveVirtualRelations(connectionId: string, database: string, relations: DiagramRelation[]): Promise<boolean>
  saveERDiagram(diagram: ERDiagram): Promise<string | null>
  openERDiagram(): Promise<ERDiagram | null>
}
