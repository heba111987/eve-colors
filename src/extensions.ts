import { app } from '@wix/astro/builders';
import eveJournal from './extensions/site/widgets/eve-journal/eve-journal.extension.ts';
import myEveGarden from './extensions/site/widgets/my-eve-garden/my-eve-garden.extension.ts';

export default app()
  .use(eveJournal)
  .use(myEveGarden);
