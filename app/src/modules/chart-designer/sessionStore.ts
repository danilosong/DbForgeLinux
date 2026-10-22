import type { ChartDocumentModel } from './model.js'

const documents = new WeakMap<object, ChartDocumentModel>()

export function getChartDocument(result: object): ChartDocumentModel | undefined { return documents.get(result) }
export function setChartDocument(result: object, document: ChartDocumentModel): void { documents.set(result, document) }
