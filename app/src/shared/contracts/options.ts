import type { AppSettings } from '../../modules/options/types.js'
export interface SettingsLoadResult { settings: AppSettings; warning?: string }
export interface OptionsApi {
  loadSettings(): Promise<SettingsLoadResult>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  resetSettings(): Promise<AppSettings>
  exportSettings(settings: AppSettings): Promise<string | null>
  importSettings(): Promise<AppSettings | null>
}
