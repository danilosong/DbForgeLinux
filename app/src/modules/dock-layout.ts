export type DockDirection = 'left' | 'right' | 'top' | 'bottom'
export type SplitOrientation = 'horizontal' | 'vertical'

export type DocumentLayoutNode = DocumentGroup | DocumentSplit
export interface DocumentGroup { type: 'group'; id: string; tabs: string[]; activeTab: string }
export interface DocumentSplit { type: 'split'; id: string; orientation: SplitOrientation; ratio: number; first: DocumentLayoutNode; second: DocumentLayoutNode }
export interface DocumentLayout { version: 1; root: DocumentLayoutNode }

export function normalizeDockDirection(value: string | null): DockDirection {
  return value === 'left' || value === 'top' || value === 'bottom' ? value : 'right'
}

export function dockDirectionClass(direction: DockDirection): string {
  return `dock-${direction}`
}

export function createDocumentLayout(documentIds: string[], groupId = 'group-1'): DocumentLayout {
  const tabs = unique(documentIds)
  return { version: 1, root: { type: 'group', id: groupId, tabs, activeTab: tabs[0] ?? '' } }
}

export function splitDocumentGroup(layout: DocumentLayout, targetDocumentId: string, documentId: string, direction: DockDirection, newGroupId: string): DocumentLayout {
  if (!documentId || documentId === targetDocumentId) return layout
  const source = findGroup(layout.root, documentId)
  const withoutSource = source ? removeDocument(layout.root, documentId) : layout.root
  if (!withoutSource) return layout
  const target = findGroup(withoutSource, targetDocumentId)
  if (!target) return layout
  const newGroup: DocumentGroup = { type: 'group', id: newGroupId, tabs: [documentId], activeTab: documentId }
  const orientation: SplitOrientation = direction === 'left' || direction === 'right' ? 'vertical' : 'horizontal'
  const newFirst = direction === 'left' || direction === 'top'
  const replacement: DocumentSplit = { type: 'split', id: `split-${newGroupId}`, orientation, ratio: 0.5, first: newFirst ? newGroup : target, second: newFirst ? target : newGroup }
  return { version: 1, root: replaceNode(withoutSource, target.id, replacement) }
}

export function mergeDocumentIntoGroup(layout: DocumentLayout, documentId: string, targetDocumentId: string): DocumentLayout {
  if (!documentId || !targetDocumentId || documentId === targetDocumentId) return layout
  const source = findGroup(layout.root, documentId)
  const target = findGroup(layout.root, targetDocumentId)
  if (!source || !target) return layout
  const removed = removeDocument(layout.root, documentId)
  if (!removed) return layout
  const remainingTarget = findGroup(removed, targetDocumentId)
  if (!remainingTarget) return layout
  const tabs = [...remainingTarget.tabs.filter((id) => id !== documentId), documentId]
  const merged: DocumentGroup = { ...remainingTarget, tabs, activeTab: documentId }
  return { version: 1, root: replaceNode(removed, remainingTarget.id, merged) }
}

export function moveDocumentToGroup(layout: DocumentLayout, documentId: string, targetGroupId: string): DocumentLayout {
  const target = findGroupById(layout.root, targetGroupId)
  const source = findGroup(layout.root, documentId)
  if (!target || !source || source.id === target.id) return layout
  const removed = removeDocument(layout.root, documentId)
  if (!removed) return layout
  const remainingTarget = findGroupById(removed, targetGroupId)
  if (!remainingTarget) return layout
  return { version: 1, root: replaceNode(removed, targetGroupId, { ...remainingTarget, tabs: [...remainingTarget.tabs, documentId], activeTab: documentId }) }
}

export function closeDocumentFromLayout(layout: DocumentLayout, documentId: string): DocumentLayout | undefined {
  if (!findGroup(layout.root, documentId)) return layout
  const root = removeDocument(layout.root, documentId)
  return root ? { version: 1, root } : undefined
}

export function setGroupRatio(layout: DocumentLayout, splitId: string, ratio: number): DocumentLayout {
  const bounded = Math.min(0.9, Math.max(0.1, ratio))
  return { version: 1, root: mapNode(layout.root, (node) => node.type === 'split' && node.id === splitId ? { ...node, ratio: bounded } : node) }
}

export function parseDocumentLayout(value: unknown, validDocumentIds: string[]): DocumentLayout | undefined {
  const validIds = new Set(validDocumentIds)
  const parsed = parseNode((value as { root?: unknown } | null)?.root, validIds)
  return parsed ? { version: 1, root: compact(parsed) } : undefined
}

export function serializeDocumentLayout(layout: DocumentLayout): string {
  return JSON.stringify(layout)
}

export function flattenDocumentGroups(node: DocumentLayoutNode): DocumentGroup[] {
  return node.type === 'group' ? [node] : [...flattenDocumentGroups(node.first), ...flattenDocumentGroups(node.second)]
}

export function findDocumentGroup(node: DocumentLayoutNode, documentId: string): DocumentGroup | undefined {
  return findGroup(node, documentId)
}

function unique(items: string[]): string[] { return [...new Set(items)] }
function findGroup(node: DocumentLayoutNode, tabId: string): DocumentGroup | undefined { return node.type === 'group' ? node.tabs.includes(tabId) ? node : undefined : findGroup(node.first, tabId) ?? findGroup(node.second, tabId) }
function findGroupById(node: DocumentLayoutNode, id: string): DocumentGroup | undefined { return node.type === 'group' ? node.id === id ? node : undefined : findGroupById(node.first, id) ?? findGroupById(node.second, id) }
function replaceNode(node: DocumentLayoutNode, id: string, replacement: DocumentLayoutNode): DocumentLayoutNode {
  if (node.type === 'group') return node.id === id ? replacement : node
  return { ...node, first: replaceNode(node.first, id, replacement), second: replaceNode(node.second, id, replacement) }
}
function removeDocument(node: DocumentLayoutNode, documentId: string): DocumentLayoutNode | undefined {
  if (node.type === 'group') {
    if (!node.tabs.includes(documentId)) return node
    const tabs = node.tabs.filter((id) => id !== documentId)
    return tabs.length ? { ...node, tabs, activeTab: node.activeTab === documentId ? tabs[0]! : node.activeTab } : undefined
  }
  const first = removeDocument(node.first, documentId)
  const second = removeDocument(node.second, documentId)
  if (!first) return second
  if (!second) return first
  return { ...node, first, second }
}
function mapNode(node: DocumentLayoutNode, update: (node: DocumentLayoutNode) => DocumentLayoutNode): DocumentLayoutNode {
  const mapped = node.type === 'group' ? node : { ...node, first: mapNode(node.first, update), second: mapNode(node.second, update) }
  return update(mapped)
}
function compact(node: DocumentLayoutNode): DocumentLayoutNode { return node.type === 'group' ? node : { ...node, first: compact(node.first), second: compact(node.second) } }
function parseNode(value: unknown, validIds: Set<string>): DocumentLayoutNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (candidate.type === 'group' && typeof candidate.id === 'string' && Array.isArray(candidate.tabs)) {
    const tabs = unique(candidate.tabs.filter((tab): tab is string => typeof tab === 'string' && validIds.has(tab)))
    if (!tabs.length) return undefined
    const activeTab = typeof candidate.activeTab === 'string' && tabs.includes(candidate.activeTab) ? candidate.activeTab : tabs[0]!
    return { type: 'group', id: candidate.id, tabs, activeTab }
  }
  if (candidate.type === 'split' && typeof candidate.id === 'string' && (candidate.orientation === 'horizontal' || candidate.orientation === 'vertical')) {
    const first = parseNode(candidate.first, validIds)
    const second = parseNode(candidate.second, validIds)
    if (!first) return second
    if (!second) return first
    const ratio = typeof candidate.ratio === 'number' && Number.isFinite(candidate.ratio) ? Math.min(0.9, Math.max(0.1, candidate.ratio)) : 0.5
    return { type: 'split', id: candidate.id, orientation: candidate.orientation, ratio, first, second }
  }
  return undefined
}
