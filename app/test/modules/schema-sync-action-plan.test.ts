import { describe, expect, it } from 'vitest'
import { createSyncActionPlan } from '../../src/modules/schema/syncActionPlan.js'

describe('schema synchronization action plan', () => {
  it('lists individual statements even when SQL shares a line', () => {
    const plan = createSyncActionPlan('USE `target`; DROP TABLE `old`; CREATE TABLE `new` (`value` varchar(20) DEFAULT \'a;b\');')
    expect(plan).toEqual([
      { title: 'Select database target', sql: 'USE `target`;' },
      { title: 'Drop old', sql: 'DROP TABLE `old`;' },
      { title: 'Create new', sql: "CREATE TABLE `new` (`value` varchar(20) DEFAULT 'a;b');" }
    ])
  })

  it('keeps custom destructive statements visible as individual actions', () => {
    expect(createSyncActionPlan('ALTER TABLE `items` ADD `active` tinyint;\nDROP TABLE `archive`;').map(({ title }) => title))
      .toEqual(['Alter items', 'Drop archive'])
  })
})
