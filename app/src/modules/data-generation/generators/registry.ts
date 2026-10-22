// One side-effect import per category; each file calls registerCatalogGenerators([...]).
// Add your category with a single line below; do not edit the others.
import './business.js'
import './product.js'
import './personal.js'
import './health.js'
import './payment.js'
import './it.js'
import './location.js'

import { registeredCatalogGenerators, type CatalogGenerator } from './types.js'

export function catalogGenerators(): readonly CatalogGenerator[] { return registeredCatalogGenerators() }
export function findCatalogGeneratorByReference(reference: string): CatalogGenerator | undefined { return registeredCatalogGenerators().find((item) => item.reference === reference) }
export function findCatalogGeneratorById(id: string): CatalogGenerator | undefined { return registeredCatalogGenerators().find((item) => item.id === id) }
