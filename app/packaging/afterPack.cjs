/* global module, process, require */
/* eslint-disable @typescript-eslint/no-require-imports */
const { join } = require('node:path')

const releaseFuseOptions = Object.freeze({
  RunAsNode: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableCookieEncryption: true,
  OnlyLoadAppFromAsar: true
})

async function applyReleaseFuses(context, dependencies = {}) {
  const env = dependencies.env ?? process.env
  if (env.TUXSQL_RELEASE_BUILD !== '1') return false
  if (context.electronPlatformName !== 'linux') throw new Error('Release fuse configuration is currently supported only for the Linux package.')

  const fuses = dependencies.fuses ?? await import('@electron/fuses')
  const executableName = context.packager.executableName || 'tuxsql'
  const executablePath = join(context.appOutDir, executableName)
  const options = {
    version: fuses.FuseVersion.V1,
    [fuses.FuseV1Options.RunAsNode]: releaseFuseOptions.RunAsNode,
    [fuses.FuseV1Options.EnableNodeOptionsEnvironmentVariable]: releaseFuseOptions.EnableNodeOptionsEnvironmentVariable,
    [fuses.FuseV1Options.EnableNodeCliInspectArguments]: releaseFuseOptions.EnableNodeCliInspectArguments,
    [fuses.FuseV1Options.EnableCookieEncryption]: releaseFuseOptions.EnableCookieEncryption,
    [fuses.FuseV1Options.OnlyLoadAppFromAsar]: releaseFuseOptions.OnlyLoadAppFromAsar
  }
  await fuses.flipFuses(executablePath, options)
  return true
}

async function afterPack(context) {
  await applyReleaseFuses(context)
}

module.exports = afterPack
module.exports.applyReleaseFuses = applyReleaseFuses
