import { computed, reactive, ref } from 'vue'
import { errorMessage } from '@/services/http'

export function useCrudDialog<Form extends object> (initial: () => Form) {
  const open = ref(false)
  const mode = ref<'create' | 'edit'>('create')
  const targetId = ref<string | null>(null)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const attempted = ref(false)
  const form = reactive(initial()) as Form
  const snapshot = ref('')

  const dirty = computed(() => open.value && JSON.stringify(form) !== snapshot.value)

  function start (values: Form): void {
    Object.assign(form, values)
    snapshot.value = JSON.stringify(form)
    error.value = null
    attempted.value = false
    open.value = true
  }

  function openCreate (values: Partial<Form> = {}): void {
    mode.value = 'create'
    targetId.value = null
    start({ ...initial(), ...values })
  }

  function openEdit (id: string, values: Partial<Form>): void {
    mode.value = 'edit'
    targetId.value = id
    start({ ...initial(), ...values })
  }

  async function submit (valid: boolean, action: () => Promise<void>): Promise<boolean> {
    attempted.value = true

    if (!valid) {
      return false
    }

    submitting.value = true
    error.value = null

    try {
      await action()
      open.value = false

      return true
    } catch (error_) {
      error.value = errorMessage(error_)

      return false
    } finally {
      submitting.value = false
    }
  }

  return reactive({ open, mode, targetId, submitting, error, attempted, form, dirty, openCreate, openEdit, submit })
}
