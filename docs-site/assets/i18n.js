/* Jawcode i18n — EN/KO toggle via data-i18n attributes */
(function () {
  let currentLang = localStorage.getItem('jwc-lang') || 'en';
  let locales = {};

  async function loadLocale(lang) {
    if (locales[lang]) return locales[lang];
    try {
      const res = await fetch(`locales/${lang}.json`);
      locales[lang] = await res.json();
      return locales[lang];
    } catch {
      return null;
    }
  }

  function applyLocale(data) {
    if (!data) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = key.split('.').reduce((o, k) => o && o[k], data);
      if (val) el.textContent = val;
    });
  }

  window.toggleLang = async function () {
    currentLang = currentLang === 'en' ? 'ko' : 'en';
    localStorage.setItem('jwc-lang', currentLang);
    const data = await loadLocale(currentLang);
    applyLocale(data);
    document.getElementById('langBtn').textContent = currentLang.toUpperCase();
  };

  // Init
  if (currentLang !== 'en') {
    loadLocale(currentLang).then(applyLocale);
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('langBtn');
      if (btn) btn.textContent = currentLang.toUpperCase();
    });
  }
})();
