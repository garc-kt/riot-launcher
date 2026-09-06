import { onUnmounted, ref } from 'vue'

export interface DragPosition {
  x: number
  y: number
}

/**
 * Pointer-based window dragging, clamped to the viewport.
 *
 * Uses pointer events with capture rather than document-level mousemove so the
 * drag survives the pointer crossing an iframe or leaving the window — the
 * League client is full of both, and a mouse-event implementation drops the
 * drag the moment the cursor passes over one.
 */
export function useDraggable(options: { onEnd?: (pos: DragPosition) => void } = {}) {
  const position = ref<DragPosition | null>(null)
  const dragging = ref(false)

  let pointerId: number | null = null
  let handle: HTMLElement | null = null
  let originX = 0
  let originY = 0
  let startX = 0
  let startY = 0
  let width = 0
  let height = 0

  const clamp = (x: number, y: number): DragPosition => {
    // Keep at least a sliver on screen so a window can always be grabbed back.
    const margin = 24
    const maxX = Math.max(margin - width, window.innerWidth - margin)
    const maxY = Math.max(0, window.innerHeight - margin)
    return {
      x: Math.min(Math.max(x, margin - width), maxX),
      y: Math.min(Math.max(y, 0), maxY),
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging.value || event.pointerId !== pointerId) return
    position.value = clamp(originX + (event.clientX - startX), originY + (event.clientY - startY))
  }

  const stop = (event?: PointerEvent) => {
    if (!dragging.value) return
    if (event && pointerId !== null && event.pointerId !== pointerId) return

    dragging.value = false
    if (handle && pointerId !== null && handle.hasPointerCapture?.(pointerId)) {
      handle.releasePointerCapture(pointerId)
    }
    handle?.removeEventListener('pointermove', onPointerMove)
    handle?.removeEventListener('pointerup', stop)
    handle?.removeEventListener('pointercancel', stop)
    handle = null
    pointerId = null

    if (position.value) options.onEnd?.(position.value)
  }

  /** Attach to the drag handle's @pointerdown. `el` is the window being moved. */
  function startDrag(event: PointerEvent, el: HTMLElement | null) {
    // Primary button only, and never start a drag from a control in the header.
    if (event.button !== 0 || !el) return
    if ((event.target as HTMLElement | null)?.closest('button, input, select, textarea, a')) return

    const rect = el.getBoundingClientRect()
    width = rect.width
    height = rect.height
    originX = rect.left
    originY = rect.top
    startX = event.clientX
    startY = event.clientY
    pointerId = event.pointerId
    dragging.value = true
    position.value = { x: originX, y: originY }

    handle = event.currentTarget as HTMLElement
    handle.setPointerCapture?.(event.pointerId)
    handle.addEventListener('pointermove', onPointerMove)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)

    event.preventDefault()
  }

  /** Pull a window back on screen after the client is resized. */
  function clampIntoView() {
    if (!position.value) return
    position.value = clamp(position.value.x, position.value.y)
  }

  function setPosition(pos: DragPosition | null) {
    position.value = pos
  }

  onUnmounted(stop)

  return { position, dragging, startDrag, clampIntoView, setPosition }
}
