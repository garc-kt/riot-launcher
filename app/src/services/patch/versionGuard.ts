import { ref } from 'vue'
import { lcuClient } from '../lcu/client'

export const currentVersion = ref<string>('14.17.1')
export const isPatchOutdated = ref<boolean>(false)

export async function checkPatchVersion(expectedMajorMinor = '14.17'): Promise<boolean> {
  try {
    const version = await lcuClient.getGameVersion()
    currentVersion.value = version
    const parts = version.split('.')
    const currentPrefix = `${parts[0]}.${parts[1]}`

    isPatchOutdated.value = currentPrefix !== expectedMajorMinor
    return !isPatchOutdated.value
  } catch {
    return true
  }
}
