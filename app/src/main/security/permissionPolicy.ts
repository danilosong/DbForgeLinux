const allowedPermissions = new Set(['clipboard-read', 'clipboard-sanitized-write'])

export function isAllowedWindowPermission(
  webContents: object | null,
  permission: string,
  primaryWebContents: object | undefined
): boolean {
  return webContents !== null && webContents === primaryWebContents && allowedPermissions.has(permission)
}
