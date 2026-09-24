import type { ClientKey, GeneratedClientKey } from '@/types/sso'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientKeysApi } from '@/services/sso'

export const useClientKeysStore = defineStore('clientKeys', () => {
  const byProject = ref<Record<string, ClientKey[]>>({})
  const loading = ref(false)

  async function load (projectId: string): Promise<ClientKey[]> {
    loading.value = true

    try {
      const keys = await clientKeysApi.list(projectId)

      byProject.value[projectId] = keys

      return keys
    } finally {
      loading.value = false
    }
  }

  async function register (projectId: string, publicKeyPem: string, expiresAt?: string): Promise<void> {
    await clientKeysApi.register({ projectId, publicKeyPem, expiresAt })
    await load(projectId)
  }

  async function generate (projectId: string): Promise<GeneratedClientKey> {
    const generated = await clientKeysApi.generate(projectId)

    await load(projectId)

    return generated
  }

  async function revoke (projectId: string, keyId: string): Promise<void> {
    await clientKeysApi.revoke(keyId)
    await load(projectId)
  }

  return { byProject, loading, load, register, generate, revoke }
})
