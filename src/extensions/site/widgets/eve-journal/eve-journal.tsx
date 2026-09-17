import { items } from '@wix/data';
import * as siteMembers from '@wix/site-members';
import { window as wixWindow } from '@wix/site-window';
import styles from './eve-journal.module.css';
import {
  EVE_PROMPTS,
  findPrompt,
  flowerMarkup,
  type EvePrompt,
} from './eve-content';

const COLLECTION_ID = 'EveJournalEntries';

const supportAndSafetyMarkup = (): string => `
  <details class="support-safety">
    <summary>Support &amp; Safety</summary>
    <p>Eve Colors is a self-reflection tool. It does not provide medical advice, diagnosis, therapy, or emergency services.</p>
    <p>If you are in the U.S. and need immediate emotional support, call or text <a href="tel:988">988</a>. If you are in immediate danger, contact local emergency services.</p>
  </details>
`;

class EveJournalElement extends HTMLElement {
  private selectedPrompt: EvePrompt | undefined;
  private savedEntry: Record<string, unknown> | undefined;
  private actionIndex = 0;

  static get observedAttributes() {
    return ['garden-path'];
  }

  connectedCallback() {
    void this.renderColorChoices();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      void this.renderColorChoices();
    }
  }

  private async renderColorChoices(): Promise<void> {
    this.selectedPrompt = undefined;
    const viewMode = await wixWindow.viewMode();
    const editorNotice = viewMode === 'Editor'
      ? '<p class="editor-note">The journal will save private member entries on the live site.</p>'
      : '';

    this.innerHTML = `
      <section class="${styles.root}" aria-label="Choose your Eve color">
        ${editorNotice}
        <div class="color-grid">
          ${EVE_PROMPTS.map((entry, index) => `
            <button class="color-card color-card-${index}" type="button" data-color="${entry.color}" aria-label="Choose ${entry.color}">
              <span class="lotus-card-art" aria-hidden="true"></span>
              <span class="color-name">${entry.color}</span>
              <span class="color-feeling">${COLOR_FEELINGS[entry.color]}</span>
            </button>
          `).join('')}
        </div>
        ${supportAndSafetyMarkup()}
      </section>
    `;

    this.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => {
      button.addEventListener('click', () => {
        const prompt = findPrompt(button.dataset.color ?? '');
        if (prompt) this.renderPrompt(prompt);
      });
    });
  }

  private renderPrompt(prompt: EvePrompt): void {
    this.selectedPrompt = prompt;
    this.innerHTML = `
      <section class="${styles.root} prompt-view" aria-live="polite">
        <p class="eyebrow">Today’s reflection · ${prompt.color.toUpperCase()}</p>
        <h2>Today’s reflection</h2>
        <p class="prompt">${prompt.prompt}</p>
        <label for="eve-answer">Write what comes to mind.</label>
        <textarea id="eve-answer" rows="6" maxlength="5000" autocomplete="off"></textarea>
        <p class="form-status" role="status"></p>
        <div class="actions">
          <button class="primary-action" type="button" data-save>Save my reflection</button>
          <button class="text-action" type="button" data-back>Choose another color</button>
        </div>
        ${supportAndSafetyMarkup()}
      </section>
    `;

    this.querySelector<HTMLButtonElement>('[data-back]')?.addEventListener('click', () => {
      void this.renderColorChoices();
    });
    this.querySelector<HTMLButtonElement>('[data-save]')?.addEventListener('click', () => {
      void this.saveMoment();
    });
  }

  private setStatus(message: string, isError = false): void {
    const status = this.querySelector<HTMLElement>('.form-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  private async saveMoment(): Promise<void> {
    const prompt = this.selectedPrompt;
    const textarea = this.querySelector<HTMLTextAreaElement>('#eve-answer');
    const saveButton = this.querySelector<HTMLButtonElement>('[data-save]');
    if (!prompt || !textarea || !saveButton) return;

    const answer = textarea.value.trim();
    if (!answer) {
      this.setStatus('Write anything that feels true for you—even a few words.', true);
      textarea.focus();
      return;
    }

    saveButton.disabled = true;
    this.setStatus('Saving your private Eve Moment…');

    try {
      let member = await siteMembers.currentMember.getMember();
      if (!member) {
        await siteMembers.authentication.promptLogin();
        member = await siteMembers.currentMember.getMember();
      }
      if (!member) throw new Error('Member login did not complete.');

      this.actionIndex = 0;
      this.savedEntry = await items.insert(COLLECTION_ID, {
        color: prompt.color,
        prompt: prompt.prompt,
        answer,
        tinyAction: prompt.routine.steps[this.actionIndex],
        actionCompleted: false,
      });
      this.renderTinyAction(prompt);
    } catch (error) {
      console.error('Failed to save Eve Moment:', error);
      this.setStatus('Your moment could not be saved yet. Please sign in and try again.', true);
      saveButton.disabled = false;
    }
  }

  private renderTinyAction(prompt: EvePrompt): void {
    const action = prompt.routine.steps[this.actionIndex];
    this.innerHTML = `
      <section class="${styles.root} action-view" aria-live="polite">
        <p class="eyebrow">One small thing for today</p>
        <h2>One small thing for today</h2>
        <p class="tiny-action">${action}</p>
        <div class="actions">
          <button class="primary-action" type="button" data-commit>I’ll do this</button>
          <button class="secondary-action" type="button" data-another>Give me another idea</button>
        </div>
      </section>
    `;
    this.querySelector<HTMLButtonElement>('[data-another]')?.addEventListener('click', () => {
      this.actionIndex = (this.actionIndex + 1) % prompt.routine.steps.length;
      this.renderTinyAction(prompt);
    });
    this.querySelector<HTMLButtonElement>('[data-commit]')?.addEventListener('click', () => {
      this.renderActionCommitment(prompt);
    });
  }

  private renderActionCommitment(prompt: EvePrompt): void {
    const action = prompt.routine.steps[this.actionIndex];
    this.innerHTML = `
      <section class="${styles.root} action-view" aria-live="polite">
        <p class="eyebrow">Your tiny action</p>
        <h2>${action}</h2>
        <p>Come back when it’s done. Small counts.</p>
        <div class="actions">
          <button class="primary-action" type="button" data-complete>I did it</button>
          <button class="text-action" type="button" data-change>Choose another idea</button>
        </div>
      </section>
    `;
    this.querySelector<HTMLButtonElement>('[data-change]')?.addEventListener('click', () => {
      this.renderTinyAction(prompt);
    });
    this.querySelector<HTMLButtonElement>('[data-complete]')?.addEventListener('click', () => {
      this.renderReward(prompt);
    });
  }

  private renderReward(prompt: EvePrompt): void {
    this.innerHTML = `
      <section class="${styles.root} success-view" aria-live="polite">
        ${flowerMarkup(prompt.color, prompt.hex, 'blooming')}
        <h2>You showed up for yourself today. 🌸</h2>
        <button class="primary-action" type="button" data-plant>Plant my flower</button>
        <p class="form-status" role="status"></p>
      </section>
    `;
    this.querySelector<HTMLButtonElement>('[data-plant]')?.addEventListener('click', () => {
      void this.plantFlower(prompt);
    });
  }

  private async plantFlower(prompt: EvePrompt): Promise<void> {
    const savedEntry = this.savedEntry;
    const button = this.querySelector<HTMLButtonElement>('[data-plant]');
    if (!savedEntry || !button) return;
    button.disabled = true;
    this.setStatus('Planting your flower…');
    try {
      this.savedEntry = await items.update(COLLECTION_ID, {
        ...savedEntry,
        tinyAction: prompt.routine.steps[this.actionIndex],
        actionCompleted: true,
        flower: `${prompt.color} Eve Flower`,
        flowerMessage: prompt.title,
      });
      this.renderSuccess(prompt);
    } catch (error) {
      console.error('Failed to plant Eve flower:', error);
      this.setStatus('Your flower could not be planted yet. Please try again.', true);
      button.disabled = false;
    }
  }

  private renderSuccess(prompt: EvePrompt): void {
    const gardenPath = this.getAttribute('garden-path') || '/my-eve-garden';
    this.innerHTML = `
      <section class="${styles.root} success-view" aria-live="polite">
        ${flowerMarkup(prompt.color, prompt.hex, 'blooming')}
        <h2>Your flower is planted.</h2>
        <p>You showed up for yourself today.</p>
        <div class="actions success-actions">
          <a class="primary-action" href="${gardenPath}">View My Garden</a>
          <a class="secondary-action" href="/">Finish for Today</a>
        </div>
      </section>
    `;
  }
}

const COLOR_FEELINGS: Record<EvePrompt['color'], string> = {
  Indigo: 'Calm & Centered',
  Teal: 'Grounded & Steady',
  Sage: 'Peaceful & Balanced',
  Gold: 'Optimistic & Inspired',
  Peach: 'Warm & Open',
  Pink: 'Loving & Gentle',
  Lilac: 'Reflective & Intuitive',
  Ember: 'Frustrated or Tense',
  Tangerine: 'Frazzled or Scattered',
  Voltage: 'Restless or Energized',
  Smoke: 'Overloaded or Depleted',
};

export default EveJournalElement;
