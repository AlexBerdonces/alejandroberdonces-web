/* ==========================================================================
   alejandroberdonces.com — Gestión de consentimiento de cookies
   No carga Google Tag Manager (ni por tanto GA4) hasta que el usuario
   pulsa "Aceptar". La elección se guarda en localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var GTM_ID = 'GTM-WRJHVFC8';
  var STORAGE_KEY = 'cookie_consent'; // 'accepted' | 'rejected'

  function loadGTM() {
    if (window.__gtmLoaded) return;
    window.__gtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = document.getElementsByTagName('script')[0];
    var j = document.createElement('script');
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    f.parentNode.insertBefore(j, f);
  }

  function getConsent() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setConsent(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* noop */ }
  }

  function showBanner(banner) {
    if (banner) banner.hidden = false;
  }

  function hideBanner(banner) {
    if (banner) banner.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('cookie-banner');
    var acceptBtn = document.getElementById('cookie-accept');
    var rejectBtn = document.getElementById('cookie-reject');
    var preferencesLink = document.getElementById('cookie-preferences');

    var consent = getConsent();

    if (consent === 'accepted') {
      loadGTM();
    } else if (consent !== 'rejected') {
      showBanner(banner);
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        setConsent('accepted');
        hideBanner(banner);
        loadGTM();
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', function () {
        setConsent('rejected');
        hideBanner(banner);
      });
    }

    if (preferencesLink) {
      preferencesLink.addEventListener('click', function (e) {
        e.preventDefault();
        showBanner(banner);
      });
    }
  });
})();
