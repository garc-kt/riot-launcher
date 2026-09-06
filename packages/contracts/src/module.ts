import { z } from 'zod'

/**
 * Passive-mode policy for a module during a live match (plan.md §0/§9.4:
 * nothing should act during InProgress). Most modules are 'strict'; a
 * couple have a real reason to differ — see the enhancement plan's Phase
 * 8 tiering for which module gets which policy and why.
 */
export type PassivePolicy = 'strict' | 'passive-dom' | 'active'

export interface ModuleCapabilities {
  /** Performs an automatic client action (accept, lock, honor, requeue).
   *  If true, the module MUST register with ctx.panic — enforced by
   *  validateModuleRegistry() below, not just documented. */
  autoActs?: boolean
  passive?: PassivePolicy
  /** Patches Ember components/router — installEmberHooks must be set. */
  usesEmber?: boolean
  usesSgp?: boolean
  /** Hostnames this module fetches from, beyond the LCU itself. */
  external?: string[]
}

export type SettingFieldType = 'toggle' | 'select' | 'number' | 'text' | 'textarea' | 'hotkey' | 'info' | 'custom'

interface SettingFieldBase {
  key: string
  type: SettingFieldType
  /** Thunked, not a static string — resolved lazily so a language switch
   *  doesn't require restarting the client (see index.js:1714 in Snooze,
   *  the reason it had to POST kill-and-restart-ux on setLanguage()). */
  label: () => string
  description?: () => string
}

export interface ToggleField extends SettingFieldBase { type: 'toggle'; default: boolean }
export interface SelectOption { value: string; label: () => string }
export interface SelectField extends SettingFieldBase { type: 'select'; options: SelectOption[]; default: string }
export interface NumberField extends SettingFieldBase { type: 'number'; min?: number; max?: number; step?: number; default: number }
export interface TextField extends SettingFieldBase { type: 'text'; default: string; placeholder?: () => string }
export interface TextareaField extends SettingFieldBase { type: 'textarea'; default: string; placeholder?: () => string }
export interface HotkeyValue { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; code: string; display: string }
export interface HotkeyField extends SettingFieldBase { type: 'hotkey'; default: HotkeyValue }
export interface InfoField extends SettingFieldBase { type: 'info' }
/** Resolved by name against a renderer registry in packages/ui — no
 *  render(el) DOM callback survives the port (enhancement plan §B.1). */
export interface CustomField extends SettingFieldBase { type: 'custom'; component: string; default?: unknown }

export type SettingField =
  | ToggleField | SelectField | NumberField | TextField
  | TextareaField | HotkeyField | InfoField | CustomField

export type SettingsSchema = SettingField[]

export interface ModuleDescriptor {
  id: string
  name: () => string
  description: () => string
  settings: SettingsSchema
  capabilities?: ModuleCapabilities
  /** Runs synchronously, before any module's init() — so an Ember hook is
   *  installed before rcp.postInit('rcp-fe-ember-libs') can possibly fire. */
  installEmberHooks?(ctx: unknown): void
  init(ctx: unknown): void | Promise<void>
  load?(): void | Promise<void>
  unload(): void | Promise<void>
  /** Called by the settings UI immediately after it writes a setting via
   *  ctx.store — the seam that replaces Snooze's inline settings[].onChange
   *  callbacks, kept separate from the (purely declarative) schema above so
   *  "what a field looks like" and "what happens when it changes" don't mix.
   *  Optional: most settings are read lazily (e.g. on the next phase event)
   *  and need no immediate reaction. */
  onSettingChange?(ctx: unknown, key: string, value: unknown): void | Promise<void>
}

const SettingFieldSchema: z.ZodType<SettingField> = z.custom<SettingField>((val) => {
  if (typeof val !== 'object' || val === null) return false
  const f = val as Record<string, unknown>
  if (typeof f.key !== 'string' || !f.key) return false
  if (typeof f.label !== 'function') return false
  const validTypes: SettingFieldType[] = ['toggle', 'select', 'number', 'text', 'textarea', 'hotkey', 'info', 'custom']
  if (!validTypes.includes(f.type as SettingFieldType)) return false
  if (f.type === 'select' && !Array.isArray(f.options)) return false
  return true
}, { message: 'invalid settings field' })

/**
 * Validate a module descriptor's static shape — the part that's checkable
 * without running the module at all. Used both as a unit test over the
 * real registry (see enhancement plan Phase 7 verification) and as a
 * crash-disable safety net if a module is ever registered dynamically.
 */
export function validateModuleDescriptor(mod: ModuleDescriptor): string[] {
  const errors: string[] = []

  if (!mod.id) errors.push('missing id')
  if (typeof mod.name !== 'function') errors.push(`${mod.id}: name must be a thunk () => string, not a static value`)
  if (typeof mod.description !== 'function') errors.push(`${mod.id}: description must be a thunk () => string`)
  if (typeof mod.init !== 'function') errors.push(`${mod.id}: missing init()`)
  if (typeof mod.unload !== 'function') errors.push(`${mod.id}: missing unload()`)

  for (const field of mod.settings || []) {
    const result = SettingFieldSchema.safeParse(field)
    if (!result.success) errors.push(`${mod.id}.settings.${(field as any)?.key ?? '?'}: invalid field`)
  }

  if (mod.capabilities?.autoActs && typeof mod.installEmberHooks !== 'function' && !mod.capabilities?.usesEmber) {
    // autoActs doesn't strictly require Ember — this is intentionally not
    // an error, just documents the common pairing. Real enforcement below.
  }
  if (mod.capabilities?.usesEmber && typeof mod.installEmberHooks !== 'function') {
    errors.push(`${mod.id}: capabilities.usesEmber is set but installEmberHooks() is missing`)
  }

  return errors
}

/**
 * The invariant the enhancement plan calls out explicitly: a module that
 * auto-acts (accepts, locks, honors, requeues) MUST register with the
 * panic system, checked statically over the registry array — not at
 * runtime, where a missing registration would just mean panic silently
 * does nothing for that module.
 */
export function validateAutoActsRegisterPanic(
  modules: ModuleDescriptor[],
  panicRegistrations: Set<string>
): string[] {
  const errors: string[] = []
  for (const mod of modules) {
    if (mod.capabilities?.autoActs && !panicRegistrations.has(mod.id)) {
      errors.push(`${mod.id}: capabilities.autoActs is true but never calls ctx.panic.register()`)
    }
  }
  return errors
}

export interface SerializedSettingField {
  key: string
  type: SettingFieldType
  label: string
  description?: string
  placeholder?: string
  default?: unknown
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  component?: string
}

export interface SerializedModuleSchema {
  id: string
  name: string
  description: string
  settings: SerializedSettingField[]
}

/** Serializes a module descriptor's schema to a static JSON-friendly representation. */
export function serializeModuleSchema(mod: ModuleDescriptor): SerializedModuleSchema {
  return {
    id: mod.id,
    name: typeof mod.name === 'function' ? mod.name() : String(mod.name),
    description: typeof mod.description === 'function' ? mod.description() : String(mod.description),
    settings: (mod.settings || []).map((field) => ({
      key: field.key,
      type: field.type,
      label: typeof field.label === 'function' ? field.label() : String(field.label),
      description: typeof field.description === 'function' ? field.description() : undefined,
      placeholder:
        typeof (field as any).placeholder === 'function'
          ? (field as any).placeholder()
          : typeof (field as any).placeholder === 'string'
            ? (field as any).placeholder
            : undefined,
      default: (field as any).default,
      options:
        field.type === 'select'
          ? field.options?.map((o) => ({
              value: o.value,
              label: typeof o.label === 'function' ? o.label() : String(o.label),
            }))
          : undefined,
      min: (field as any).min,
      max: (field as any).max,
      step: (field as any).step,
      component: (field as any).component,
    })),
  }
}

/** Deserializes a schema loaded from JSON into thunked SettingsSchema for SettingsSchemaRenderer. */
export function deserializeModuleSchema(serialized: SerializedModuleSchema): SettingsSchema {
  return (serialized.settings || []).map((s) => ({
    key: s.key,
    type: s.type,
    label: () => s.label,
    description: s.description ? () => s.description! : undefined,
    placeholder: s.placeholder ? () => s.placeholder! : undefined,
    default: s.default,
    options: s.options?.map((o) => ({ value: o.value, label: () => o.label })),
    min: s.min,
    max: s.max,
    step: s.step,
    component: s.component,
  })) as SettingsSchema
}

