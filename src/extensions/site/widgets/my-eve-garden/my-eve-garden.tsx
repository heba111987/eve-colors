import { items } from '@wix/data';
import * as siteMembers from '@wix/site-members';
import { window as wixWindow } from '@wix/site-window';
import styles from './my-eve-garden.module.css';
import {
  EVE_PROMPTS,
  escapeHtml,
  findPrompt,
  flowerMarkup,
  type EveColorName,
} from '../eve-journal/eve-content';

const COLLECTION_ID = 'EveJournalEntries';
const LOAD_TIMEOUT_MS = 12_000;
const MEMBER_RETRY_COUNT = 6;
const MEMBER_RETRY_DELAY_MS = 350;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out.`)), LOAD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

interface GardenEntry {
  id: string;
  color: EveColorName;
  prompt: string;
  answer: string;
  date: Date;
  tinyAction: string;
  actionCompleted: boolean;
  flower: string;
}

const stringField = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : '';
};

const dateField = (record: Record<string, unknown>): Date => {
  const value = record._createdDate;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

class EveGardenElement extends HTMLElement {

  connectedCallback() {
    void this.render();
  }

  private async render(): Promise<void> {
    const viewMode = await wixWindow.viewMode();
    // Pricing-plan member orders are unavailable in both Wix Editor and Preview.
    if (viewMode === 'Editor' || viewMode === 'Preview') {
      this.renderEditorPreview();
      return;
    }

    this.renderLoading();
    let memberIsLoggedIn = false;
    try {
      const member = await withTimeout(
        siteMembers.currentMember.getMember(),
        'Current member check',
      );
      memberIsLoggedIn = Boolean(member);
    } catch (error) {
      console.error('Failed to check the current Eve Garden member:', error);
      this.renderLoadError('We could not check your member session. Please try again.');
      return;
    }

    if (!memberIsLoggedIn) {
      this.renderSignedOut();
      return;
    }

    await this.loadMemberGarden();
  }

  private async loadMemberGarden(): Promise<void> {
    this.renderLoading();
    try {
      const result = await withTimeout(
        items.query(COLLECTION_ID)
          .descending('_createdDate')
          .limit(100)
          .find({ consistentRead: true }),
        'Garden data request',
      );

      const entries = result.items.flatMap((item): GardenEntry[] => {
        const record: Record<string, unknown> = item;
        const color = stringField(record, 'color');
        const knownPrompt = findPrompt(color);
        if (!knownPrompt) return [];
        return [{
          id: stringField(record, '_id'),
          color: knownPrompt.color,
          prompt: stringField(record, 'prompt'),
          answer: stringField(record, 'answer'),
          date: dateField(record),
          tinyAction: stringField(record, 'tinyAction'),
          actionCompleted: record.actionCompleted === true || Boolean(stringField(record, 'flower')),
          flower: stringField(record, 'flower'),
        }];
      });
      this.renderGarden(entries);
    } catch (error) {
      console.error('Failed to load Eve Garden entries:', error);
      this.renderLoadError('You are signed in, but your Garden could not be loaded. Please try again.');
    }
  }

  private async waitForLoggedInMember(): Promise<boolean> {
    for (let attempt = 0; attempt < MEMBER_RETRY_COUNT; attempt += 1) {
      const member = await siteMembers.currentMember.getMember();
      if (member) return true;
      await wait(MEMBER_RETRY_DELAY_MS);
    }
    return false;
  }

  private renderLoading(): void {
    this.innerHTML = `
      <section class="${styles.root} centered" aria-live="polite">
        <p>Gathering your private garden…</p>
      </section>
    `;
  }

  private renderEditorPreview(): void {
    this.renderGarden(EVE_PROMPTS.slice(0, 4).map((prompt, index) => ({
      id: `preview-${index}`,
      color: prompt.color,
      prompt: prompt.prompt,
      answer: 'Your private reflection appears here only for you.',
      date: new Date(),
      tinyAction: prompt.routine.steps[0],
      actionCompleted: true,
      flower: `${prompt.color} Eve Flower`,
    })));
  }

  private renderGarden(entries: readonly GardenEntry[]): void {
    const momentLabel = entries.length === 1 ? 'Eve Moment' : 'Eve Moments';
    this.innerHTML = `
      <section class="${styles.root}">
        <header>
          <p class="eyebrow">A private space that belongs to you</p>
          <h2>My Eve Garden</h2>
          <p>Your garden grows whenever you return. There is no falling behind.</p>
        </header>
        <div class="garden-scene ${entries.length === 0 ? 'is-empty' : ''}">
          <div class="garden-sun" aria-hidden="true"></div>
          <div class="garden-cloud cloud-one" aria-hidden="true"></div>
          <div class="garden-cloud cloud-two" aria-hidden="true"></div>
          <div class="garden-hill hill-back" aria-hidden="true"></div>
          <div class="garden-hill hill-front" aria-hidden="true"></div>
          <div class="garden-progress">
            <strong>Day by day,<br>your garden becomes a <em>field</em></strong>
            <span class="moment-count">${entries.length}</span>
            <small>${momentLabel}</small>
          </div>
          ${entries.length === 0 ? `
            <div class="empty-garden">
              <div class="sprout" aria-hidden="true"><i></i><b></b></div>
              <strong>Your garden is ready.</strong>
              <span>Your first flower will grow after you save an Eve Moment.</span>
            </div>
          ` : `
            <div class="background-blooms" aria-hidden="true">
              ${Array.from({ length: 18 }, (_, index) => `<i style="--bloom-index: ${index}"></i>`).join('')}
            </div>
            <div class="garden-grid">
              ${entries.map((entry, index) => {
                const prompt = findPrompt(entry.color);
                if (!prompt) return '';
                return `
                  <button class="garden-flower" style="--growth-level: ${index % 5}; --garden-sway: ${(index % 5) - 2}deg" type="button" data-entry-index="${index}" aria-label="Open ${entry.color} flower from ${entry.date.toLocaleDateString()}">
                    <span class="plant" aria-hidden="true">
                      <span class="flower-head">${flowerMarkup(entry.color, prompt.hex)}</span>
                      <span class="stem"><i class="leaf leaf-left"></i><i class="leaf leaf-right"></i></span>
                    </span>
                    <span class="garden-date">${entry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </button>
                `;
              }).join('')}
            </div>
          `}
          <div class="garden-soil" aria-hidden="true"></div>
        </div>
        <div class="privacy-controls">
          <h3>Your privacy controls</h3>
          <p>Delete individual Eve Moments when you open them, or permanently delete your entire journal.</p>
          <button class="danger-action" type="button" data-delete-all ${entries.length === 0 ? 'disabled' : ''}>Delete All Eve Moments</button>
        </div>
        <div class="entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-title" hidden></div>
        <div class="delete-all-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-all-title" hidden></div>
      </section>
    `;

    this.querySelectorAll<HTMLButtonElement>('[data-entry-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.entryIndex);
        const entry = Number.isInteger(index) ? entries[index] : undefined;
        if (entry) this.openEntry(entry);
      });
    });
    this.querySelector<HTMLButtonElement>('[data-delete-all]')?.addEventListener('click', () => {
      this.openDeleteAllConfirmation();
    });
  }

  private openEntry(entry: GardenEntry): void {
    const dialog = this.querySelector<HTMLElement>('.entry-dialog');
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="dialog-card">
        <button class="dialog-close" type="button" aria-label="Close journal entry">×</button>
        <p class="entry-date">${entry.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <h3 id="entry-title">${escapeHtml(entry.color)}</h3>
        <p class="saved-prompt">${escapeHtml(entry.prompt)}</p>
        <p class="saved-answer">${escapeHtml(entry.answer)}</p>
        <h4>One small thing</h4>
        <p class="saved-action">${escapeHtml(entry.tinyAction || 'No tiny action was recorded for this earlier entry.')}</p>
        <p class="completion-status">${entry.actionCompleted ? 'Completed' : 'Not completed'}</p>
        <p class="earned-flower">${escapeHtml(entry.flower || 'Flower not yet planted')}</p>
        <div class="entry-actions">
          <button class="danger-action" type="button" data-delete-entry>Delete This Eve Moment</button>
        </div>
        <p class="delete-status" role="status"></p>
      </div>
    `;
    dialog.hidden = false;
    dialog.querySelector<HTMLButtonElement>('.dialog-close')?.addEventListener('click', () => {
      dialog.hidden = true;
    });
    dialog.querySelector<HTMLButtonElement>('[data-delete-entry]')?.addEventListener('click', () => {
      this.showEntryDeleteConfirmation(entry);
    });
  }

  private showEntryDeleteConfirmation(entry: GardenEntry): void {
    const dialog = this.querySelector<HTMLElement>('.entry-dialog');
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="dialog-card confirmation-card">
        <h3 id="entry-title">Delete this Eve Moment?</h3>
        <p>This permanently removes your ${escapeHtml(entry.color)} reflection. This cannot be undone.</p>
        <div class="confirmation-actions">
          <button class="danger-action" type="button" data-confirm-delete>Delete Permanently</button>
          <button class="secondary-action" type="button" data-cancel-delete>Keep My Moment</button>
        </div>
        <p class="delete-status" role="status"></p>
      </div>
    `;
    dialog.querySelector<HTMLButtonElement>('[data-cancel-delete]')?.addEventListener('click', () => {
      this.openEntry(entry);
    });
    dialog.querySelector<HTMLButtonElement>('[data-confirm-delete]')?.addEventListener('click', () => {
      void this.deleteEntry(entry.id, dialog);
    });
  }

  private async deleteEntry(entryId: string, dialog: HTMLElement): Promise<void> {
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button) => { button.disabled = true; });
    const status = dialog.querySelector<HTMLElement>('.delete-status');
    if (status) status.textContent = 'Deleting your Eve Moment…';
    try {
      await items.remove(COLLECTION_ID, entryId);
      await this.render();
    } catch (error) {
      console.error('Failed to delete Eve Moment:', error);
      if (status) status.textContent = 'This moment could not be deleted yet. Please try again.';
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  private openDeleteAllConfirmation(): void {
    const dialog = this.querySelector<HTMLElement>('.delete-all-dialog');
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="dialog-card confirmation-card">
        <h3 id="delete-all-title">Delete your entire Eve Journal?</h3>
        <p>Every saved Eve Moment will be permanently removed. This cannot be undone.</p>
        <div class="confirmation-actions">
          <button class="danger-action" type="button" data-confirm-delete-all>Delete My Entire Journal</button>
          <button class="secondary-action" type="button" data-cancel-delete-all>Keep My Journal</button>
        </div>
        <p class="delete-status" role="status"></p>
      </div>
    `;
    dialog.hidden = false;
    dialog.querySelector<HTMLButtonElement>('[data-cancel-delete-all]')?.addEventListener('click', () => {
      dialog.hidden = true;
    });
    dialog.querySelector<HTMLButtonElement>('[data-confirm-delete-all]')?.addEventListener('click', () => {
      void this.deleteAllEntries(dialog);
    });
  }

  private async deleteAllEntries(dialog: HTMLElement): Promise<void> {
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((button) => { button.disabled = true; });
    const status = dialog.querySelector<HTMLElement>('.delete-status');
    if (status) status.textContent = 'Deleting your Eve Journal…';
    try {
      while (true) {
        const result = await items.query(COLLECTION_ID).limit(1000).find({ consistentRead: true });
        const entryIds = result.items.flatMap((item) => {
          const id = item._id;
          return typeof id === 'string' && id ? [id] : [];
        });
        if (entryIds.length === 0) break;
        await items.bulkRemove(COLLECTION_ID, entryIds);
        if (entryIds.length < 1000) break;
      }
      await this.render();
    } catch (error) {
      console.error('Failed to delete Eve Journal:', error);
      if (status) status.textContent = 'Your journal could not be deleted yet. Please try again.';
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  private renderSignedOut(): void {
    this.innerHTML = `
      <section class="${styles.root} centered" aria-live="polite">
        <h2>My Eve Garden</h2>
        <p>Please sign in to open your private garden.</p>
        <button class="primary-action" type="button" data-sign-in>Sign In</button>
        <p class="purchase-status" role="status"></p>
      </section>
    `;

    this.querySelector<HTMLButtonElement>('[data-sign-in]')?.addEventListener('click', () => {
      const button = this.querySelector<HTMLButtonElement>('[data-sign-in]');
      const status = this.querySelector<HTMLElement>('.purchase-status');
      if (!button) return;

      button.disabled = true;
      if (status) status.textContent = 'Opening secure sign in…';

      // Keep this call directly inside the click event so Safari recognizes the user gesture.
      siteMembers.authentication.promptLogin()
        .then(async () => {
          if (status) status.textContent = 'Opening your private garden…';
          const memberIsReady = await this.waitForLoggedInMember();
          if (!memberIsReady) {
            this.renderLoadError('Your sign-in completed, but the member session is not ready yet. Please try again.');
            return;
          }
          await this.loadMemberGarden();
        })
        .catch((error: unknown) => {
          console.info('Eve Garden sign in was cancelled or did not complete:', error);
          if (status) status.textContent = 'Sign in was not completed. You can try again whenever you are ready.';
          button.disabled = false;
        });
    });
  }

  private renderLoadError(message: string): void {
    this.innerHTML = `
      <section class="${styles.root} centered" aria-live="polite">
        <h2>My Eve Garden</h2>
        <p>${escapeHtml(message)}</p>
        <button class="primary-action" type="button" data-retry>Try Again</button>
      </section>
    `;
    this.querySelector<HTMLButtonElement>('[data-retry]')?.addEventListener('click', () => {
      void this.render();
    });
  }
}

export default EveGardenElement;
