export type AboutLink = 'documentation' | 'repository' | 'license'

export interface AboutInfo {
  name: string
  version: string
  creator: string
  license: string
  electron: string
  chromium: string
  node: string
  mysql2: string
  platform: string
  architecture: string
}

export interface AboutApi {
  getAboutInfo(): Promise<AboutInfo>
  openAboutLink(link: AboutLink, locale?: 'en' | 'pt-BR', theme?: 'light' | 'dark'): Promise<void>
}
