import { h } from 'vue'
import { createPinia, PiniaSymbol } from 'pinia'

export const withPinia = (storyFn, context) => {
  const pinia = createPinia()

  /* Provide Pinia globally so all setup() / components can use pinia stores */
  return {
    setup() {
      /* Provide Pinia at the app level for any inject(PiniaSymbol) usage.
         Storybook manages the app instance for us; we use a wrapping
         element to provide the pinia symbol */
      return () =>
        h(
          'div',
          { style: { all: 'initial' } },
          [
            h(storyFn(context)),
          ],
        )
    },
    /* PiniaPlugin: by default, global provides reach */
    provide: {
      [PiniaSymbol]: pinia,
    },
  }
}
