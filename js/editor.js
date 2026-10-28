/**
 * CodeMirror 5 Editor controller module.
 */
class EditorController {
  constructor(containerEl, options = {}) {
    this.containerEl = containerEl;
    this.onChange = options.onChange || null;
    this.lastSavedCode = '';
    this.isDirty = false;

    if (typeof CodeMirror === 'undefined') {
      console.error('CodeMirror is not loaded! Check script tags.');
      return;
    }

    this.cm = CodeMirror(this.containerEl, {
      value: options.initialValue || '',
      mode: 'javascript',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      matchBrackets: true,
      autoCloseBrackets: true,
    });

    this.lastSavedCode = this.cm.getValue();

    this.cm.on('change', () => {
      const currentCode = this.cm.getValue();
      const dirty = currentCode !== this.lastSavedCode;
      if (dirty !== this.isDirty) {
        this.isDirty = dirty;
      }
      if (this.onChange) {
        this.onChange(currentCode, this.isDirty);
      }
    });

    // Ensure editor focus and layout refresh
    this.containerEl.addEventListener('click', () => {
      if (this.cm) {
        this.cm.focus();
      }
    });

    // Multiple layout refreshes to handle asynchronous rendering / fonts
    requestAnimationFrame(() => {
      if (this.cm) {
        this.cm.refresh();
      }
    });
    setTimeout(() => {
      if (this.cm) {
        this.cm.refresh();
      }
    }, 100);
    setTimeout(() => {
      if (this.cm) {
        this.cm.refresh();
      }
    }, 300);
  }

  getValue() {
    return this.cm ? this.cm.getValue() : '';
  }

  setValue(code) {
    if (!this.cm) return;
    this.cm.setValue(code || '');
    this.lastSavedCode = code || '';
    this.isDirty = false;
    this.cm.clearHistory();
    this.refresh();
  }

  markSaved() {
    if (!this.cm) return;
    this.lastSavedCode = this.cm.getValue();
    this.isDirty = false;
    if (this.onChange) {
      this.onChange(this.lastSavedCode, false);
    }
  }

  focus() {
    if (this.cm) {
      this.cm.focus();
    }
  }

  refresh() {
    if (this.cm) {
      this.cm.refresh();
    }
  }
}

