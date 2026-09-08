(function () {
  function showPrompt(title, placeholder, initialValue, inputType) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
        '<div class="modal-title"></div>' +
        '<input class="modal-input" type="' + (inputType || 'text') + '">' +
        '<div class="modal-actions">' +
        '<button class="modal-btn modal-cancel">' + I18N.t('common.cancel') + '</button>' +
        '<button class="modal-btn modal-ok">' + I18N.t('common.ok') + '</button>' +
        '</div></div>';
      overlay.querySelector('.modal-title').textContent = title;
      const input = overlay.querySelector('.modal-input');
      input.placeholder = placeholder || '';
      input.value = initialValue || '';
      document.body.appendChild(overlay);
      input.focus();
      if (initialValue) input.select();

      function close(value) {
        document.body.removeChild(overlay);
        resolve(value);
      }
      overlay.querySelector('.modal-ok').addEventListener('click', () => close(input.value.trim() || null));
      overlay.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value.trim() || null);
        if (e.key === 'Escape') close(null);
      });
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    });
  }

  function showNoteForm(dialogTitle, initial) {
    initial = initial || {};
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
        '<div class="modal-title"></div>' +
        '<input class="modal-input modal-note-title" type="text" placeholder="' + I18N.t('modal.note_title_placeholder') + '">' +
        '<textarea class="modal-input modal-textarea modal-note-body" rows="5" placeholder="' + I18N.t('modal.note_body_placeholder') + '"></textarea>' +
        '<div class="modal-actions">' +
        '<button class="modal-btn modal-cancel">' + I18N.t('common.cancel') + '</button>' +
        '<button class="modal-btn modal-ok">' + I18N.t('common.save') + '</button>' +
        '</div></div>';
      overlay.querySelector('.modal-title').textContent = dialogTitle;
      const titleInput = overlay.querySelector('.modal-note-title');
      const bodyInput = overlay.querySelector('.modal-note-body');
      titleInput.value = initial.title || '';
      bodyInput.value = initial.text || '';
      document.body.appendChild(overlay);
      titleInput.focus();
      if (initial.title) titleInput.select();

      function close(value) {
        document.body.removeChild(overlay);
        resolve(value);
      }
      function submit() {
        const title = titleInput.value.trim();
        const text = bodyInput.value.trim();
        if (!title && !text) { close(null); return; }
        close({ title: title || I18N.t('modal.untitled_note'), text });
      }
      overlay.querySelector('.modal-ok').addEventListener('click', submit);
      overlay.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); bodyInput.focus(); }
        if (e.key === 'Escape') close(null);
      });
      bodyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) submit();
        if (e.key === 'Escape') close(null);
      });
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    });
  }

  function showServerForm(dialogTitle, initial) {
    initial = initial || {};
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box modal-box-wide">' +
        '<div class="modal-title"></div>' +
        '<label class="modal-field-label">' + I18N.t('modal.server_name_label') + '</label>' +
        '<input class="modal-input f-name" type="text" placeholder="' + I18N.t('modal.server_name_placeholder') + '">' +
        '<div class="modal-field-row">' +
        '<div><label class="modal-field-label">' + I18N.t('modal.server_host_label') + '</label><input class="modal-input f-host" type="text" placeholder="' + I18N.t('modal.server_host_placeholder') + '"></div>' +
        '<div class="modal-field-narrow"><label class="modal-field-label">' + I18N.t('modal.server_port_label') + '</label><input class="modal-input f-port" type="text" placeholder="8212"></div>' +
        '</div>' +
        '<div class="modal-field-row">' +
        '<div><label class="modal-field-label">' + I18N.t('modal.server_username_label') + '</label><input class="modal-input f-username" type="text" placeholder="' + I18N.t('modal.server_username_placeholder') + '"></div>' +
        '<div><label class="modal-field-label">' + I18N.t('modal.server_password_label') + '</label><input class="modal-input f-password" type="password"></div>' +
        '</div>' +
        '<label class="modal-checkbox-row"><input type="checkbox" class="f-https"> ' + I18N.t('modal.server_use_https') + '</label>' +
        '<label class="modal-checkbox-row"><input type="checkbox" class="f-remember"> ' + I18N.t('modal.server_remember_password') + '</label>' +
        '<div class="modal-hint">' + I18N.t('modal.server_remember_hint') + '</div>' +
        '<div class="modal-status"></div>' +
        '<div class="modal-actions">' +
        '<button class="modal-btn modal-cancel">' + I18N.t('common.cancel') + '</button>' +
        '<button class="modal-btn modal-test">' + I18N.t('modal.test_connection') + '</button>' +
        '<button class="modal-btn modal-ok">' + I18N.t('common.save') + '</button>' +
        '</div></div>';
      overlay.querySelector('.modal-title').textContent = dialogTitle;
      const nameInput = overlay.querySelector('.f-name');
      const hostInput = overlay.querySelector('.f-host');
      const portInput = overlay.querySelector('.f-port');
      const userInput = overlay.querySelector('.f-username');
      const passInput = overlay.querySelector('.f-password');
      const httpsInput = overlay.querySelector('.f-https');
      const rememberInput = overlay.querySelector('.f-remember');
      const statusEl = overlay.querySelector('.modal-status');

      nameInput.value = initial.name || '';
      hostInput.value = initial.host || '';
      portInput.value = initial.port || '8212';
      userInput.value = initial.username || 'admin';
      passInput.value = initial.password || '';
      httpsInput.checked = !!initial.https;
      rememberInput.checked = !!initial.rememberPassword;

      document.body.appendChild(overlay);
      nameInput.focus();

      function readForm() {
        return {
          id: initial.id || ('srv' + Date.now() + Math.random().toString(36).slice(2, 7)),
          name: nameInput.value.trim() || hostInput.value.trim() || I18N.t('common.server_word'),
          host: hostInput.value.trim(),
          port: parseInt(portInput.value, 10) || 8212,
          username: userInput.value.trim() || 'admin',
          password: passInput.value,
          https: httpsInput.checked,
          rememberPassword: rememberInput.checked,
          enabled: initial.enabled !== undefined ? initial.enabled : true,
        };
      }

      function close(value) {
        document.body.removeChild(overlay);
        resolve(value);
      }
      overlay.querySelector('.modal-test').addEventListener('click', async () => {
        const form = readForm();
        if (!form.host) { statusEl.textContent = I18N.t('modal.host_required_first'); statusEl.className = 'modal-status error'; return; }
        statusEl.textContent = I18N.t('modal.testing');
        statusEl.className = 'modal-status';
        try {
          const info = await window.PalServerAPI.getInfo(form);
          statusEl.textContent = I18N.t('modal.connected') + ' ' + (info.servername || 'server') + ' (' + (info.version || '?') + ')';
          statusEl.className = 'modal-status ok';
        } catch (e) {
          statusEl.textContent = I18N.t('modal.failed_prefix') + ' ' + e.message;
          statusEl.className = 'modal-status error';
        }
      });
      overlay.querySelector('.modal-ok').addEventListener('click', () => {
        const form = readForm();
        if (!form.host) { statusEl.textContent = I18N.t('modal.host_required'); statusEl.className = 'modal-status error'; return; }
        close(form);
      });
      overlay.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    });
  }

  function showConfirm(title, message, confirmLabel, danger) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
        '<div class="modal-title"></div>' +
        '<div class="modal-confirm-message"></div>' +
        '<div class="modal-actions">' +
        '<button class="modal-btn modal-cancel">' + I18N.t('common.cancel') + '</button>' +
        '<button class="modal-btn ' + (danger ? 'modal-danger' : 'modal-ok') + '"></button>' +
        '</div></div>';
      overlay.querySelector('.modal-title').textContent = title;
      overlay.querySelector('.modal-confirm-message').textContent = message;
      const confirmBtn = overlay.querySelector('.modal-danger, .modal-ok');
      confirmBtn.textContent = confirmLabel || I18N.t('common.confirm');
      document.body.appendChild(overlay);
      confirmBtn.focus();

      function close(value) { document.body.removeChild(overlay); resolve(value); }
      confirmBtn.addEventListener('click', () => close(true));
      overlay.querySelector('.modal-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(false); });
    });
  }

  function showShutdownForm() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
        '<div class="modal-title">' + I18N.t('modal.shutdown_title') + '</div>' +
        '<label class="modal-field-label">' + I18N.t('modal.wait_time_label') + '</label>' +
        '<input class="modal-input f-waittime" type="text" value="60">' +
        '<label class="modal-field-label">' + I18N.t('modal.message_to_players_label') + '</label>' +
        '<input class="modal-input f-message" type="text" placeholder="' + I18N.t('modal.shutdown_message_placeholder') + '">' +
        '<div class="modal-actions">' +
        '<button class="modal-btn modal-cancel">' + I18N.t('common.cancel') + '</button>' +
        '<button class="modal-btn modal-danger">' + I18N.t('modal.shutdown_button') + '</button>' +
        '</div></div>';
      const waitInput = overlay.querySelector('.f-waittime');
      const msgInput = overlay.querySelector('.f-message');
      document.body.appendChild(overlay);
      waitInput.focus();
      waitInput.select();

      function close(value) { document.body.removeChild(overlay); resolve(value); }
      overlay.querySelector('.modal-danger').addEventListener('click', () => {
        const waittime = parseInt(waitInput.value, 10);
        if (isNaN(waittime) || waittime < 0) return;
        close({ waittime, message: msgInput.value.trim() });
      });
      overlay.querySelector('.modal-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    });
  }

  function showProfileManager(initialProfiles, activeName, handlers) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
        '<div class="modal-title">' + I18N.t('modal.switch_profile_title') + '</div>' +
        '<div class="pm-lang-row"></div>' +
        '<div class="profile-list"></div>' +
        '<button class="add-btn" id="pmNewProfileBtn">' + I18N.t('modal.new_profile_button') + '</button>' +
        '<div class="modal-actions"><button class="modal-btn modal-cancel" id="pmCloseBtn">' + I18N.t('common.close') + '</button></div>' +
        '</div>';
      document.body.appendChild(overlay);
      I18N.renderSwitcher(overlay.querySelector('.pm-lang-row'));
      const listEl = overlay.querySelector('.profile-list');
      let profiles = initialProfiles.slice();

      function draw() {
        listEl.innerHTML = '';
        for (const p of profiles) {
          const row = document.createElement('div');
          row.className = 'profile-row' + (p === activeName ? ' active' : '');
          const btn = document.createElement('button');
          btn.className = 'profile-select-btn';
          btn.textContent = (p === activeName ? '✓ ' : '') + p;
          btn.addEventListener('click', () => handlers.onSwitch(p));
          row.appendChild(btn);
          if (profiles.length > 1) {
            const del = document.createElement('button');
            del.className = 'profile-delete-btn';
            del.textContent = '✕';
            del.title = I18N.t('modal.delete_profile_prefix');
            del.addEventListener('click', async () => {
              const ok = await showConfirm(
                I18N.t('modal.delete_profile_prefix') + ' "' + p + '"?',
                I18N.t('modal.delete_profile_warning'),
                I18N.t('modal.delete'), true
              );
              if (!ok) return;
              await handlers.onDelete(p);
              profiles = profiles.filter((x) => x !== p);
              draw();
            });
            row.appendChild(del);
          }
          listEl.appendChild(row);
        }
      }
      draw();

      function close() { document.body.removeChild(overlay); resolve(); }
      overlay.querySelector('#pmNewProfileBtn').addEventListener('click', async () => {
        const entered = await showPrompt(I18N.t('modal.new_profile_title'), I18N.t('modal.enter_name_placeholder'));
        const trimmed = (entered || '').trim();
        if (!trimmed) return;
        if (!/^[A-Za-z0-9 _-]{1,30}$/.test(trimmed)) {
          await showConfirm(I18N.t('modal.invalid_name_title'), I18N.t('modal.invalid_name_message'), I18N.t('common.ok'));
          return;
        }
        if (profiles.includes(trimmed)) {
          await showConfirm(I18N.t('modal.already_exists_title'), I18N.t('modal.already_exists_message'), I18N.t('common.ok'));
          return;
        }
        await handlers.onCreate(trimmed);
        await handlers.onSwitch(trimmed);
      });
      overlay.querySelector('#pmCloseBtn').addEventListener('click', close);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    });
  }

  window.showPrompt = showPrompt;
  window.showNoteForm = showNoteForm;
  window.showServerForm = showServerForm;
  window.showConfirm = showConfirm;
  window.showShutdownForm = showShutdownForm;
  window.showProfileManager = showProfileManager;
})();
