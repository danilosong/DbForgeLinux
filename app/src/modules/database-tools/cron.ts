const fields = [{ min: 0, max: 59 }, { min: 0, max: 23 }, { min: 1, max: 31 }, { min: 1, max: 12 }, { min: 0, max: 7 }]

export function validateCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error('Schedule must use five fields: minute hour day month weekday.')
  parts.forEach((field, index) => {
    if (!/^(?:\*|\*\/\d+|\d+(?:-\d+)?)(?:,\d+(?:-\d+)?)*$/.test(field)) throw new Error(`Invalid schedule field: ${field}`)
    for (const unit of field.split(',')) {
      const [range, stepText] = unit.split('/')
      const [first, last = first] = range === '*' ? [fields[index]!.min, fields[index]!.max] : range!.split('-').map(Number)
      if (!Number.isInteger(first) || !Number.isInteger(last) || first < fields[index]!.min || last > fields[index]!.max || last < first) throw new Error(`Schedule field is out of range: ${field}`)
      if (stepText && (!Number.isInteger(Number(stepText)) || Number(stepText) < 1 || Number(stepText) > fields[index]!.max - fields[index]!.min + 1)) throw new Error('Schedule step is outside the valid range.')
    }
  })
  return parts.join(' ')
}

export function cronMatches(expression: string, date: Date): boolean {
  const values = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()]
  const parts = validateCron(expression).split(' ')
  const matches = (field: string, index: number): boolean => field.split(',').some((unit) => {
    const [range, stepText] = unit.split('/'); const step = stepText ? Number(stepText) : 1
    const [start, end = start] = range === '*' ? [fields[index]!.min, fields[index]!.max] : range!.split('-').map(Number)
    const candidates = index === 4 && values[index] === 0 ? [0, 7] : [values[index]!]
    return candidates.some((value) => value >= start! && value <= end! && (value - start!) % step === 0)
  })
  const dayMonthWildcard = parts[2] === '*'; const weekDayWildcard = parts[4] === '*'
  const calendarMatches = dayMonthWildcard || weekDayWildcard ? matches(parts[2]!, 2) && matches(parts[4]!, 4) : matches(parts[2]!, 2) || matches(parts[4]!, 4)
  return matches(parts[0]!, 0) && matches(parts[1]!, 1) && calendarMatches && matches(parts[3]!, 3)
}

export function nextCronRun(expression: string, after = new Date()): Date | null {
  const cron = validateCron(expression)
  const candidate = new Date(after); candidate.setSeconds(0, 0); candidate.setMinutes(candidate.getMinutes() + 1)
  for (let minute = 0; minute < 366 * 24 * 60; minute += 1) {
    if (cronMatches(cron, candidate)) return candidate
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return null
}
