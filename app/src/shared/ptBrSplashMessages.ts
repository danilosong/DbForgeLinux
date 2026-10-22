import type { splashEnMessages } from './splashMessages.js'

export const ptBrModulesSplash: Record<keyof typeof splashEnMessages, string> = {
  'splash.brand.kicker': 'CLIENTE DE BANCO DE DADOS · LINUX',
  'splash.stage.starting': 'Iniciando o TuxSQL',
  'splash.stage.vault': 'Abrindo o cofre seguro',
  'splash.stage.settings': 'Carregando configurações',
  'splash.stage.interface': 'Iniciando a interface',
  'splash.stage.editor': 'Carregando o editor',
  'splash.stage.ready': 'Pronto',
  'splash.stage.error': 'O TuxSQL não conseguiu concluir o carregamento'
}
