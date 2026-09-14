import { computed, reactive, ref } from 'vue'
import { errorMessage } from '@/services/http'

/**
 * Estado de um modal de cadastro e edicao.
 *
 * O erro do servidor fica dentro do modal, e o modal nao fecha quando falha:
 * a pessoa precisa ver o motivo ao lado do que digitou. `dirty` compara com o
 * que abriu, e liga a confirmacao de descarte do `DlFormDialog`.
 *
 * Devolve um objeto reativo, para o template ler `dialog.open` e
 * `dialog.form.name` sem `.value`.
 */
export function useCrudDialog<Form extends object> (initial: () => Form) {
  const open = ref(false)
  const mode = ref<'create' | 'edit'>('create')
  const targetId = ref<string | null>(null)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  /** Liga as mensagens de validacao so depois da primeira tentativa. */
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

  /**
   * Roda a gravacao. `valid` e conferido antes: formulario invalido nao chega
   * ao servidor, e as mensagens aparecem ao lado dos campos.
   */
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
