import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: 'b07c339a-03f8-4120-b0db-901e346d201c',
  name: 'Eve Journal',
  width: {
    defaultWidth: 980,
    allowStretch: true
  },
  height: {
    defaultHeight: 620
  },
  installation: {
    autoAdd: false
  },
  presets: [
    {
      id: 'f2a49132-cb6d-4f3a-9889-5f83c39b1f67',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/eve-journal-thumbnail.png',
    },
  ],
  
  tagName: 'eve-journal',
  element: './extensions/site/widgets/eve-journal/eve-journal.tsx',
  settings: './extensions/site/widgets/eve-journal/eve-journal.panel.tsx',
});
