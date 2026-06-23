/**
 * Storybook mock for @vueuse/integrations/useFocusTrap
 * Real focus-trap in iframe blocks Storybook controls panel interaction.
 */
export function useFocusTrap() {
  return {
    activate: () => {},
    deactivate: () => {},
  }
}
