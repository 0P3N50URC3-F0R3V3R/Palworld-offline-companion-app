(function () {
  // Ordered alphabetically by each language's own native display name (NATIVE_NAMES
  // below), not by code - so the switcher lists options the way a reader scans them.
  var SUPPORTED = ['indonesian', 'malay', 'czech', 'danish', 'german', 'english', 'spanish',
    'latam', 'french', 'italian', 'hungarian', 'dutch', 'norwegian', 'polish', 'portuguese',
    'brazilian', 'romanian', 'finnish', 'swedish', 'vietnamese', 'turkish', 'greek', 'bulgarian',
    'russian', 'ukrainian', 'arabic', 'thai', 'koreana', 'japanese', 'schinese', 'tchinese'];
  var RTL = ['arabic'];
  var NATIVE_NAMES = {
    english: 'English', arabic: 'العربية', bulgarian: 'Български', schinese: '简体中文',
    tchinese: '繁體中文', czech: 'Čeština', danish: 'Dansk', dutch: 'Nederlands', finnish: 'Suomi',
    french: 'Français', german: 'Deutsch', greek: 'Ελληνικά', hungarian: 'Magyar',
    indonesian: 'Bahasa Indonesia', italian: 'Italiano', japanese: '日本語', koreana: '한국어',
    malay: 'Bahasa Melayu', norwegian: 'Norsk', polish: 'Polski', portuguese: 'Português',
    brazilian: 'Português (Brasil)', romanian: 'Română', russian: 'Русский', spanish: 'Español',
    latam: 'Español (Latinoamérica)', swedish: 'Svenska', thai: 'ไทย', turkish: 'Türkçe',
    ukrainian: 'Українська', vietnamese: 'Tiếng Việt',
  };

  // Maps browser navigator.language tags (e.g. "hu-HU", "pt-BR", "zh-Hant") to the closest
  // supported Steam-code catalog. Pure function, no DOM/globals touched - testable in Node.
  function matchLanguage(tags, supported) {
    var BCP47 = {
      en: 'english', ar: 'arabic', bg: 'bulgarian', cs: 'czech', da: 'danish', nl: 'dutch',
      fi: 'finnish', fr: 'french', de: 'german', el: 'greek', hu: 'hungarian', id: 'indonesian',
      it: 'italian', ja: 'japanese', ko: 'koreana', ms: 'malay', nb: 'norwegian', no: 'norwegian',
      pl: 'polish', pt: 'portuguese', ro: 'romanian', ru: 'russian', es: 'spanish', sv: 'swedish', th: 'thai',
      tr: 'turkish', uk: 'ukrainian', vi: 'vietnamese',
    };
    for (var i = 0; i < tags.length; i++) {
      var tag = (tags[i] || '').toLowerCase();
      if (tag.indexOf('zh') === 0) {
        var zhCode = /tw|hk|hant/.test(tag) ? 'tchinese' : 'schinese';
        if (supported.indexOf(zhCode) !== -1) return zhCode;
      }
      if (tag.indexOf('pt-br') === 0 || tag === 'pt_br') {
        if (supported.indexOf('brazilian') !== -1) return 'brazilian';
      }
      if (tag.indexOf('es-') === 0 && tag.indexOf('es-es') !== 0) {
        if (supported.indexOf('latam') !== -1) return 'latam';
      }
      var base = tag.split('-')[0];
      var mapped = BCP47[base];
      if (mapped && supported.indexOf(mapped) !== -1) return mapped;
    }
    return 'english';
  }

  var catalog = {};
  var fallback = {};
  var current = 'english';
  var readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });

  function t(key) {
    if (catalog[key] != null) return catalog[key];
    if (fallback[key] != null) return fallback[key];
    return key;
  }

  function applyNode(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  function setHtmlDirLang(lang) {
    document.documentElement.setAttribute('lang', lang === 'english' ? 'en' : lang);
    document.documentElement.setAttribute('dir', RTL.indexOf(lang) !== -1 ? 'rtl' : 'ltr');
  }

  function loadCatalog(lang) {
    return fetch('lang/' + lang + '.json').then(function (r) {
      if (!r.ok) throw new Error('missing catalog: ' + lang);
      return r.json();
    });
  }

  // Only sets `current`/localStorage/catalog once the fetch actually succeeds - a
  // missing/broken catalog file must never leave the UI on a language with no text,
  // and must never get written to localStorage (see init()'s deadlock note below).
  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'english';
    return loadCatalog(lang).then(function (data) {
      current = lang;
      catalog = data;
      try { localStorage.setItem('lang', lang); } catch (e) {}
      setHtmlDirLang(lang);
      applyNode(document);
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
    });
  }

  function init() {
    var stored = null;
    try { stored = localStorage.getItem('lang'); } catch (e) {}
    var initialLang = stored && SUPPORTED.indexOf(stored) !== -1
      ? stored
      : matchLanguage(navigator.languages || [navigator.language], SUPPORTED);
    current = initialLang;
    return loadCatalog('english').then(function (data) {
      fallback = data;
      if (initialLang === 'english') return data;
      // If the stored/detected language's catalog is missing, fall back to English
      // instead of leaving I18N.ready unresolved forever - a fetch failure here used
      // to permanently brick the app on reload, since app.js awaits I18N.ready before
      // rendering anything.
      return loadCatalog(initialLang).catch(function () {
        current = 'english';
        try { localStorage.setItem('lang', 'english'); } catch (e) {}
        return data;
      });
    }).then(function (data) {
      catalog = data;
      setHtmlDirLang(current);
      applyNode(document);
      readyResolve();
    });
  }

  function renderSwitcher(containerEl) {
    if (!containerEl) return;
    var select = document.createElement('select');
    select.className = 'lang-switcher-select';
    select.setAttribute('aria-label', t('lang.switcher_aria'));
    SUPPORTED.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = NATIVE_NAMES[code] || code;
      if (code === current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function () { setLanguage(select.value).then(function () { window.location.reload(); }); });
    containerEl.innerHTML = '';
    containerEl.appendChild(select);
    document.addEventListener('i18n:changed', function (e) { select.value = e.detail.lang; });
  }

  window.I18N = {
    t: t, apply: applyNode, setLanguage: setLanguage, renderSwitcher: renderSwitcher,
    ready: ready, get lang() { return current; }, SUPPORTED: SUPPORTED, _matchLanguage: matchLanguage,
  };
  init();
})();
