import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: 'ef20f8a9-f552-4557-8ebd-d73cc9135a26',
  name: 'My Eve Garden',
  width: {
    defaultWidth: 980,
    allowStretch: true
  },
  height: {
    defaultHeight: 720
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: 'bf1ef6c8-7ec6-48a6-bd60-0adfa56e006b',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/my-eve-garden-thumbnail.png',
    },
  ],
  
  tagName: 'my-eve-garden',
  element: './extensions/site/widgets/my-eve-garden/my-eve-garden.tsx',
  settings: './extensions/site/widgets/my-eve-garden/my-eve-garden.panel.tsx',
});
