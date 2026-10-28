/**
 * p5.js Sandboxed Runner Controller (Standalone Edition).
 * Manages full iframe destruction and re-creation using local runner.html.
 */
class RunnerController {
  constructor(containerEl, consoleEl, options = {}) {
    this.containerEl = containerEl;
    this.consoleEl = consoleEl;
    this.currentIframe = null;
    this.isRunning = false;
    this.onRunComplete = options.onRunComplete || null;

    // Listen for log / error events sent from inside the runner
    window.addEventListener('message', this.handleIframeMessage.bind(this));
  }

  appendConsoleLine(text, type = 'info') {
    if (!this.consoleEl) return;
    const allowedTypes = ['info', 'warn', 'error', 'system'];
    const safeType = allowedTypes.includes(type) ? type : 'info';
    const line = document.createElement('div');
    line.className = `console-line ${safeType}`;
    line.textContent = text;
    this.consoleEl.appendChild(line);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }

  clearConsole() {
    if (this.consoleEl) {
      this.consoleEl.innerHTML = '';
    }
  }

  handleIframeMessage(event) {
    if (!this.currentIframe || event.source !== this.currentIframe.contentWindow) return;
    if (!event.data) return;
    const data = event.data;

    switch (data.type) {
      case 'CONSOLE_LOG':
        this.appendConsoleLine(data.message, data.level || 'info');
        break;

      case 'RUNTIME_ERROR':
        const lineInfo = data.line ? ` [Line ${data.line}]` : '';
        this.appendConsoleLine(`【エラー】${lineInfo} ${data.message}`, 'error');
        if (this.onRunComplete) {
          this.onRunComplete({
            success: false,
            error_line: data.line || null,
            error_message: data.message,
          });
        }
        break;

      case 'EXECUTION_COMPLETE':
        if (data.success) {
          this.appendConsoleLine('✓ 描画ループを開始しました。', 'system');
          if (this.onRunComplete) {
            this.onRunComplete({ success: true });
          }
        }
        break;
    }
  }

  run(code) {
    // 1. Fully destroy existing iframe to clean all state, timers, and infinite loops
    this.stop(false);

    this.clearConsole();
    this.appendConsoleLine('> スケッチの実行準備中...', 'system');

    // 2. Create clean iframe pointing to local runner.html
    // Apply strict sandbox isolation on HTTP/HTTPS (e.g. GitHub Pages), while skipping
    // on file:// so local offline execution can load lib/p5.js without CORS blocks.
    const iframe = document.createElement('iframe');
    iframe.className = 'canvas-iframe';
    if (window.location.protocol !== 'file:') {
      iframe.setAttribute('sandbox', 'allow-scripts allow-modals');
    }
    iframe.src = 'runner.html';

    iframe.onload = () => {
      // Ensure runner page script and p5 are ready
      setTimeout(() => {
        if (this.currentIframe === iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'EXECUTE_CODE',
            code: code,
          }, '*');
        }
      }, 50);
    };

    this.containerEl.appendChild(iframe);
    this.currentIframe = iframe;
    this.isRunning = true;
  }

  stop(logNotice = true) {
    if (this.currentIframe) {
      try {
        // Disconnect src and remove from DOM immediately aborts all running JS loops
        this.currentIframe.src = 'about:blank';
        this.currentIframe.remove();
      } catch (e) {
        // Ignore removal error
      }
      this.currentIframe = null;
    }
    this.isRunning = false;

    if (logNotice) {
      this.appendConsoleLine('■ 実行を停止しました。', 'system');
    }
  }
}
