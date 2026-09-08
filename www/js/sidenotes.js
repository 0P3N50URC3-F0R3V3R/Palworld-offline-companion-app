(function () {
  var MAX_CHARS = 25000;
  var AUTOSAVE_DELAY = 1000;

  var quill = null;
  var loaded = false;
  var profileName = null;
  var saveTimer = null;
  var saveInFlight = false;
  var saveAgain = false;

  async function fetchJson(url, opts) {
    var res = await fetch(url, opts);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  function build() {
    // A real <button> here renders fine in modern Chromium, but older Chromium builds
    // (e.g. Electron 8's bundled Chromium 80) don't apply vertical writing-mode to form
    // controls at all and silently fall back to horizontal text - a plain <div> with an
    // ARIA button role isn't a form control, so it renders vertical everywhere.
    var tab = document.createElement('div');
    tab.id = 'sidenotesTab';
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    tab.textContent = I18N.t('sidenotes.tab_label');
    document.body.appendChild(tab);

    var panel = document.createElement('div');
    panel.id = 'sidenotesPanel';
    panel.innerHTML =
      '<div id="sidenotesHeader">' +
        '<div class="title">' + I18N.t('sidenotes.title') + '</div>' +
        '<button id="sidenotesClose" type="button">&times;</button>' +
      '</div>' +
      '<div id="sidenotesBody">' +
        '<div id="sidenotesEditor"></div>' +
        '<div id="sidenotesFooter">' +
          '<span id="sidenotesCount">0 / ' + MAX_CHARS + '</span>' +
          '<span id="sidenotesStatus"></span>' +
          '<button id="sidenotesSaveBtn" type="button">' + I18N.t('common.save') + '</button>' +
        '</div>' +
      '</div>' +
      '<div id="sidenotesGuest" style="display:none">' + I18N.t('sidenotes.select_profile_to_use') + '</div>';
    document.body.appendChild(panel);

    tab.addEventListener('click', function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) ensureLoaded();
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      tab.click();
    });
    document.getElementById('sidenotesClose').addEventListener('click', function () {
      panel.classList.remove('open');
    });
    document.getElementById('sidenotesSaveBtn').addEventListener('click', function () {
      save(true);
    });
  }

  async function ensureLoaded() {
    if (loaded) return;
    loaded = true;

    var active = await fetchJson('api/active-profile.php').catch(function () { return { name: null }; });
    profileName = active.name || null;
    if (!profileName) {
      document.getElementById('sidenotesGuest').style.display = 'block';
      document.getElementById('sidenotesBody').style.display = 'none';
      return;
    }

    quill = new Quill('#sidenotesEditor', {
      theme: 'snow',
      modules: {
        toolbar: [['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']],
      },
    });
    quill.on('text-change', function () {
      enforceLimit();
      updateCount();
      setStatus('');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { save(false); }, AUTOSAVE_DELAY);
    });

    var data = await fetchJson('api/sidenotes-load.php?user=' + encodeURIComponent(profileName)).catch(function () { return { html: '' }; });
    quill.root.innerHTML = data.html || '';
    updateCount();
  }

  function plainTextLength() {
    return quill.getText().replace(/\n$/, '').length;
  }

  function enforceLimit() {
    var len = plainTextLength();
    if (len > MAX_CHARS) {
      quill.deleteText(MAX_CHARS, len - MAX_CHARS);
    }
  }

  function updateCount() {
    var el = document.getElementById('sidenotesCount');
    var len = plainTextLength();
    el.textContent = len + ' / ' + MAX_CHARS;
    el.classList.toggle('over', len > MAX_CHARS);
  }

  function setStatus(text) {
    document.getElementById('sidenotesStatus').textContent = text;
  }

  async function save(manual) {
    if (!quill) return;
    if (saveInFlight) { saveAgain = true; return; }
    saveInFlight = true;
    var btn = document.getElementById('sidenotesSaveBtn');
    if (manual) btn.disabled = true;
    setStatus(I18N.t('common.saving'));
    try {
      await fetchJson('api/sidenotes-save.php?user=' + encodeURIComponent(profileName), {
        method: 'POST',
        body: JSON.stringify({ html: quill.root.innerHTML }),
      });
      setStatus(I18N.t('sidenotes.saved'));
    } catch (e) {
      setStatus(I18N.t('common.save_failed'));
    } finally {
      saveInFlight = false;
      if (manual) btn.disabled = false;
      if (saveAgain) { saveAgain = false; save(false); }
    }
  }

  function init() {
    I18N.ready.then(build);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
