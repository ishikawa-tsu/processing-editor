/**
 * Processing Web IDE - Standalone Edition Orchestrator.
 * Fully local application controller without server / database / auth dependencies.
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const fileNameInput = document.getElementById('file-name-input');
  const dirtyIndicatorEl = document.getElementById('dirty-indicator');
  const btnRun = document.getElementById('btn-run');
  const btnStop = document.getElementById('btn-stop');
  const btnSave = document.getElementById('btn-save');
  const btnNew = document.getElementById('btn-new');
  const btnOpen = document.getElementById('btn-open');
  const btnHelp = document.getElementById('btn-help');
  const fileUploadInput = document.getElementById('file-upload-input');
  const editorContainer = document.getElementById('editor-container');
  const canvasContainer = document.getElementById('canvas-container');
  const consoleBody = document.getElementById('console-body');
  const toastContainer = document.getElementById('toast-container');
  const dropZone = document.getElementById('drop-zone');
  const dragOverlay = document.getElementById('drag-overlay');

  // Modals
  const confirmModal = document.getElementById('confirm-modal');
  const confirmMessageEl = document.getElementById('confirm-message');
  const btnConfirmOk = document.getElementById('btn-confirm-ok');
  const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
  const helpModal = document.getElementById('help-modal');

  // Application State
  let currentFileName = '';
  let pendingAction = null;
  let sketchCounter = 1;
  let autoSaveTimer = null;

  const STORAGE_KEY_CODE = 'processing_standalone_draft_code';
  const STORAGE_KEY_FILENAME = 'processing_standalone_draft_filename';

  // 1. Toast Notification Helper
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // 2. File Name Helpers
  function sanitizeFileName(name) {
    if (!name || typeof name !== 'string') return 'sketch_01.pde';
    let sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!sanitized) return 'sketch_01.pde';
    if (!sanitized.endsWith('.pde') && !sanitized.endsWith('.js') && !sanitized.endsWith('.txt')) {
      sanitized += '.pde';
    }
    if (sanitized.length > 80) {
      sanitized = sanitized.substring(0, 80);
    }
    return sanitized;
  }

  function generateDateSequenceName() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const seq = String(sketchCounter).padStart(2, '0');
    return `sketch_${yy}${mm}${dd}_${seq}.pde`;
  }

  function setFileName(name) {
    currentFileName = sanitizeFileName(name);
    fileNameInput.value = currentFileName;
    try {
      localStorage.setItem(STORAGE_KEY_FILENAME, currentFileName);
    } catch (e) {}
  }

  fileNameInput.addEventListener('change', () => {
    setFileName(fileNameInput.value);
  });
  fileNameInput.addEventListener('blur', () => {
    setFileName(fileNameInput.value);
  });

  // 3. Subsystem Initialization
  const runner = new RunnerController(canvasContainer, consoleBody);

  const editor = new EditorController(editorContainer, {
    initialValue: '',
    onChange: (code, isDirty) => {
      if (isDirty) {
        dirtyIndicatorEl.classList.add('visible');
      } else {
        dirtyIndicatorEl.classList.remove('visible');
      }

      // Auto-save draft to localStorage (debounced 500ms)
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY_CODE, code);
        } catch (e) {}
      }, 500);
    },
  });

  // 4. Initial Setup (Restore Draft or Start Blank)
  function initEditorContent() {
    let savedCode = null;
    let savedName = null;
    try {
      savedCode = localStorage.getItem(STORAGE_KEY_CODE);
      savedName = localStorage.getItem(STORAGE_KEY_FILENAME);
    } catch (e) {}

    if (savedCode !== null && savedCode.trim() !== '') {
      editor.setValue(savedCode);
      setFileName(savedName || generateDateSequenceName());
      runner.appendConsoleLine('> 前回の作業コードを自動復元しました。', 'system');
      showToast('前回のコードを復元しました', 'info', 2500);
    } else {
      // Start with blank editor per specification
      editor.setValue('');
      setFileName(generateDateSequenceName());
      dirtyIndicatorEl.classList.remove('visible');
    }
    editor.focus();
  }

  initEditorContent();

  // 5. Modal Confirmation Helper
  function requireConfirmIfDirty(message, onConfirm) {
    if (!editor.isDirty) {
      onConfirm();
      return;
    }
    confirmMessageEl.textContent = message;
    confirmModal.classList.add('active');
    pendingAction = onConfirm;
  }

  btnConfirmOk.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      action();
    }
  });

  btnConfirmCancel.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    pendingAction = null;
  });

  // Close modals on click
  document.querySelectorAll('.modal-close-btn, .btn-modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('active'));
      pendingAction = null;
    });
  });

  // 6. Action Handlers

  // Run Code
  function executeRun() {
    const code = editor.getValue();
    runner.run(code);
  }
  btnRun.addEventListener('click', executeRun);

  // Stop Code
  btnStop.addEventListener('click', () => {
    runner.stop();
  });

  // Save (Download .pde)
  function executeSave() {
    const code = editor.getValue();
    const filename = sanitizeFileName(fileNameInput.value || currentFileName);

    try {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      editor.markSaved();
      dirtyIndicatorEl.classList.remove('visible');
      showToast(`✓ '${filename}' をダウンロードしました。`, 'success');
      runner.appendConsoleLine(`> '${filename}' を保存（ダウンロード）しました。`, 'system');
    } catch (err) {
      showToast(`保存に失敗しました: ${err.message}`, 'error');
    }
  }
  btnSave.addEventListener('click', executeSave);

  // New Sketch
  btnNew.addEventListener('click', () => {
    requireConfirmIfDirty(
      '未保存の変更があります。変更を破棄して新規スケッチを作成しますか？',
      () => {
        sketchCounter++;
        setFileName(generateDateSequenceName());
        editor.setValue('');
        editor.markSaved();
        dirtyIndicatorEl.classList.remove('visible');
        try {
          localStorage.removeItem(STORAGE_KEY_CODE);
        } catch (e) {}
        runner.stop(false);
        runner.clearConsole();
        runner.appendConsoleLine(`> 新規スケッチ '${currentFileName}' を作成しました。`, 'system');
        showToast('新規スケッチを作成しました', 'info');
      }
    );
  });

  // Open (Upload File)
  btnOpen.addEventListener('click', () => {
    fileUploadInput.click();
  });

  function processUploadedFile(file) {
    if (!file) return;

    const fileName = file.name || '';
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx !== -1 ? fileName.substring(dotIdx).toLowerCase() : '';

    const allowed = ['.pde', '.js', '.txt'];
    if (!allowed.includes(ext)) {
      showToast(`対応していないファイル形式です (${ext || '拡張子なし'})。対応形式: .pde, .js, .txt`, 'error', 4000);
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      showToast('ファイルサイズが大きすぎます (上限: 2MB)。', 'error');
      return;
    }

    const doLoad = () => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result || '';
        setFileName(fileName);
        editor.setValue(content);
        editor.markSaved();
        dirtyIndicatorEl.classList.remove('visible');

        runner.stop(false);
        runner.clearConsole();
        runner.appendConsoleLine(`> ファイル '${fileName}' を読み込みました。`, 'system');
        showToast(`✓ '${fileName}' を読み込みました。`, 'success');
      };
      reader.onerror = () => {
        showToast('ファイルの読み込みに失敗しました。', 'error');
      };
      reader.readAsText(file, 'UTF-8');
    };

    requireConfirmIfDirty(
      '未保存の変更があります。変更を破棄してファイルを読み込みますか？',
      doLoad
    );
  }

  fileUploadInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    fileUploadInput.value = '';
    if (file) {
      processUploadedFile(file);
    }
  });

  // 7. Drag & Drop File Loader
  if (dropZone && dragOverlay) {
    let dragCounter = 0;

    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      dragOverlay.classList.add('active');
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dragOverlay.classList.remove('active');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dragOverlay.classList.remove('active');

      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        processUploadedFile(dt.files[0]);
      }
    });
  }

  // 8. Help Modal
  if (btnHelp && helpModal) {
    btnHelp.addEventListener('click', () => {
      helpModal.classList.add('active');
    });
  }

  // 9. Keyboard Shortcuts (Win / Mac Cross-Platform)
  window.addEventListener('keydown', (e) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // Save: Ctrl+S / Cmd+S
    if (isCtrlOrMeta && e.key === 's') {
      e.preventDefault();
      executeSave();
      return;
    }

    // Run: Ctrl+Enter / Cmd+Enter
    if (isCtrlOrMeta && e.key === 'Enter') {
      e.preventDefault();
      executeRun();
      return;
    }
  });
});
