/**
 * Cross-template drag-drop coordination for CV section reordering.
 *
 * Each template (`ClassicDoc`, `ModernDoc`, `CreativeDoc`, `ProfessionalDoc`) defines its own
 * grip (drag source) inside `renderSectionTitle` and its own `reorderPreviewSections`
 * (drop handler). To let users drop anywhere on a section — not just on the small title bar —
 * we share the drag state and the drop signal through a module-level variable + a window
 * event:
 *
 *   - `activeDraggingSectionId` is set by the grip's `onDragStart` and cleared on `onDragEnd`.
 *   - `CVSectionWrapper` reads it to decide whether to call `e.preventDefault()` in
 *     `onDragOver` (which is required for HTML5 drop targets to accept a drop).
 *   - On drop, the wrapper dispatches `cv:section-reorder-drop` with `{targetSectionId}`,
 *     which the active template subscribes to and forwards to its `reorderPreviewSections`.
 *
 * Only the currently rendered template has a subscriber, so there is no risk of
 * double-handling across templates.
 */

export const SECTION_REORDER_DROP_EVENT_NAME = 'cv:section-reorder-drop';
export const SECTION_DRAG_END_EVENT_NAME = 'cv:section-drag-end';

export type SectionReorderDropDetail = { targetSectionId: string };

let activeDraggingSectionId: string | null = null;

export function setActiveDraggingSectionId(id: string | null): void {
  activeDraggingSectionId = id;
}

export function getActiveDraggingSectionId(): string | null {
  return activeDraggingSectionId;
}

export function dispatchSectionReorderDrop(targetSectionId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SectionReorderDropDetail>(SECTION_REORDER_DROP_EVENT_NAME, {
      detail: { targetSectionId },
    }),
  );
}

/** Fired when a section drag ends (drop or cancel) so drop targets can clear hover state. */
export function dispatchSectionDragEnd(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SECTION_DRAG_END_EVENT_NAME));
}
