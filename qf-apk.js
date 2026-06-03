var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
(function () {
    'use strict';
    var LS_DOWNLOADS = 'qf_offline_downloads';
    var LS_DISMISSED = 'qf_update_dismissed_build';
    var LS_SETTINGS = 'sineq_settings';
    var LANG_KEY = 'sineq_lang';
    var OLD_LANG_KEY = 'qfLang';
    var DEFAULT_SETTINGS = { autoplay: true, autoNext: true, tryFullscreen: true, tryLandscape: true, notifications: false };
    var APK_UA = /; wv\)|Android.*Version\/\d+|SineQAPK/i.test(navigator.userAgent);
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    var mobile = window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile || standalone || APK_UA)
        document.documentElement.classList.add('qf-mobile-root'), document.body && document.body.classList.add('qf-apk-mode');
    function ready(fn) { document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }
    var REPORT_I18N = {
        tr: { 'settings.autoNext': 'Sonraki bölüme otomatik geç', 'settings.report': 'Sorun bildir', 'report.title': 'Sorun bildir', 'report.type': 'Sorun türü', 'report.type.bug': 'Genel hata', 'report.type.player': 'Video / oynatma', 'report.type.account': 'Hesap / giriş', 'report.type.other': 'Diğer', 'report.message': 'Yaşadığın sorunu kısaca yaz...', 'report.contact': 'İletişim (opsiyonel e-posta)', 'report.send': 'Raporu gönder', 'report.sent': 'Rapor gönderildi. Admin paneline düştü.', 'report.error': 'Rapor gönderilemedi.', 'report.required': 'Lütfen sorunu yaz.' },
        ar: { 'settings.autoNext': 'تشغيل الحلقة التالية تلقائياً', 'settings.report': 'الإبلاغ عن مشكلة', 'report.title': 'الإبلاغ عن مشكلة', 'report.type': 'نوع المشكلة', 'report.type.bug': 'خطأ عام', 'report.type.player': 'الفيديو / التشغيل', 'report.type.account': 'الحساب / الدخول', 'report.type.other': 'أخرى', 'report.message': 'اكتب المشكلة باختصار...', 'report.contact': 'وسيلة تواصل (اختياري)', 'report.send': 'إرسال البلاغ', 'report.sent': 'تم إرسال البلاغ إلى لوحة الإدارة.', 'report.error': 'تعذر إرسال البلاغ.', 'report.required': 'يرجى كتابة المشكلة.' },
        en: { 'settings.autoNext': 'Auto-play next episode', 'settings.report': 'Report a problem', 'report.title': 'Report a problem', 'report.type': 'Problem type', 'report.type.bug': 'General bug', 'report.type.player': 'Video / playback', 'report.type.account': 'Account / login', 'report.type.other': 'Other', 'report.message': 'Briefly describe the problem...', 'report.contact': 'Contact (optional email)', 'report.send': 'Send report', 'report.sent': 'Report sent to the admin panel.', 'report.error': 'Report could not be sent.', 'report.required': 'Please describe the problem.' }
    };
    function t(key) {
        var fromApp = window.qfT ? window.qfT(key) : key;
        if (fromApp && fromApp !== key)
            return fromApp;
        var lang = (localStorage.getItem(LANG_KEY) || localStorage.getItem(OLD_LANG_KEY) || 'tr');
        var shortLang = String(lang).split('-')[0];
        return (REPORT_I18N[lang] && REPORT_I18N[lang][key]) || (REPORT_I18N[shortLang] && REPORT_I18N[shortLang][key]) || (REPORT_I18N.tr && REPORT_I18N.tr[key]) || key;
    }
    function toast(msg) { var el = document.querySelector('.qf-apk-toast'); if (!el) {
        el = document.createElement('div');
        el.className = 'qf-apk-toast';
        document.body.appendChild(el);
    } el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(function () { return el.classList.remove('show'); }, 2600); }
    window.qfToast = toast;
    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]); }); }
    function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }
    function getSettings() { try {
        return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}'));
    }
    catch (e) {
        return Object.assign({}, DEFAULT_SETTINGS);
    } }
    function saveSettings(settings) { localStorage.setItem(LS_SETTINGS, JSON.stringify(Object.assign({}, DEFAULT_SETTINGS, settings || {}))); }
    function getSetting(name, fallback) { var s = getSettings(); return typeof s[name] === 'undefined' ? fallback : s[name]; }
    window.qfGetSettings = getSettings;
    window.qfGetSetting = getSetting;
    window.qfSetSetting = function (name, value) { var s = getSettings(); s[name] = !!value; saveSettings(s); renderSettingsState(); toast(t('settings.saved')); };
    function getCurrentLang() { return localStorage.getItem(LANG_KEY) || localStorage.getItem(OLD_LANG_KEY) || 'tr'; }
    function setLanguage(lang) { if (window.qfApplyLang)
        window.qfApplyLang(lang);
    else {
        localStorage.setItem(LANG_KEY, lang);
        localStorage.setItem(OLD_LANG_KEY, lang);
    } renderDynamicText(); renderSettingsState(); }
    function getDownloads() { try {
        return JSON.parse(localStorage.getItem(LS_DOWNLOADS) || '[]');
    }
    catch (e) {
        return [];
    } }
    function saveDownloads(items) { localStorage.setItem(LS_DOWNLOADS, JSON.stringify(items.slice(0, 80))); }
    function registerDownload(item) { var items = getDownloads().filter(function (x) { return x.url !== item.url; }); items.unshift({ title: item.title || 'Video', url: item.url, type: item.type || 'video', createdAt: Date.now() }); saveDownloads(items); }
    window.qfRegisterDownload = registerDownload;
    function canDirectDownload(url) { return !!url && /\.mp4(\?|#|$)/i.test(url) && !/(drive\.google|youtube|youtu\.be|iframe|embed)/i.test(url); }
    window.qfCanDirectDownload = canDirectDownload;
    function openSearch() { var input = document.getElementById('search-input'); if (input) {
        input.focus();
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } }
    function renderDownloads() {
        var sheet = document.getElementById('qf-downloads-sheet');
        if (!sheet)
            return;
        var items = getDownloads();
        var list = sheet.querySelector('[data-qf-download-list]');
        sheet.querySelector('[data-qf-sheet-title]').textContent = t('downloads.title');
        if (!items.length) {
            list.innerHTML = '<div class="qf-empty-downloads">' + t('downloads.empty') + '</div>';
            return;
        }
        list.innerHTML = items.map(function (x) { return "<div class=\"qf-download-card\"><div><b>".concat(escapeHtml(x.title), "</b><small>").concat(new Date(x.createdAt).toLocaleString(getCurrentLang() === 'tr' ? 'tr-TR' : undefined), "</small></div><a href=\"").concat(escapeAttr(x.url), "\" target=\"_blank\" rel=\"noopener\">").concat(escapeHtml(t('downloads.open')), "</a></div>"); }).join('');
    }
    function openDownloads() { var _a; renderDownloads(); closeProfileSheet(); closeSettings(); (_a = document.getElementById('qf-downloads-sheet')) === null || _a === void 0 ? void 0 : _a.classList.add('open'); setActive('downloads'); }
    function closeDownloads() { var _a; (_a = document.getElementById('qf-downloads-sheet')) === null || _a === void 0 ? void 0 : _a.classList.remove('open'); }
    window.qfOpenDownloads = openDownloads;
    window.qfCloseDownloads = closeDownloads;
    function openProfileSheet() { var _a; renderProfileSheet(); closeDownloads(); closeSettings(); (_a = document.getElementById('qf-profile-sheet')) === null || _a === void 0 ? void 0 : _a.classList.add('open'); setActive('profile'); }
    function closeProfileSheet() { var _a; (_a = document.getElementById('qf-profile-sheet')) === null || _a === void 0 ? void 0 : _a.classList.remove('open'); }
    window.qfOpenProfileSheet = openProfileSheet;
    window.qfCloseProfileSheet = closeProfileSheet;
    function openSettings() { var _a; renderSettingsState(); closeDownloads(); closeProfileSheet(); (_a = document.getElementById('qf-settings-sheet')) === null || _a === void 0 ? void 0 : _a.classList.add('open'); setActive('profile'); }
    function closeSettings() { var _a; (_a = document.getElementById('qf-settings-sheet')) === null || _a === void 0 ? void 0 : _a.classList.remove('open'); }
    window.qfOpenSettings = openSettings;
    window.qfCloseSettings = closeSettings;
    function setActive(name) { document.querySelectorAll('.qf-mobile-bottom-nav button').forEach(function (b) { return b.classList.toggle('active', b.dataset.qfTab === name); }); }
    function switchMarkup(key, checked) {
        return "<button class=\"qf-switch ".concat(checked ? 'on' : '', "\" type=\"button\" data-qf-setting=\"").concat(key, "\" aria-pressed=\"").concat(checked, "\"><span></span><b>").concat(checked ? t('settings.on') : t('settings.off'), "</b></button>");
    }
    function versionText() {
        var _a, _b;
        var meta = ((_a = document.querySelector('meta[name="app-version"]')) === null || _a === void 0 ? void 0 : _a.content) || window.SINEQ_VERSION || '';
        return meta || ((_b = document.getElementById('qf-settings-sheet')) === null || _b === void 0 ? void 0 : _b.dataset.version) || '1.0.0';
    }
    function loadVersion() {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, v, el, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' })];
                    case 1:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _b.sent();
                        v = String(data.version || data.build || '1.0.0');
                        (_a = document.getElementById('qf-settings-sheet')) === null || _a === void 0 ? void 0 : _a.setAttribute('data-version', v);
                        el = document.querySelector('[data-qf-version]');
                        if (el)
                            el.textContent = v;
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function renderSettingsState() {
        var sheet = document.getElementById('qf-settings-sheet');
        if (!sheet)
            return;
        var settings = getSettings();
        var langSelect = sheet.querySelector('[data-qf-lang-select]');
        if (langSelect)
            langSelect.value = getCurrentLang();
        sheet.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
        sheet.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
        sheet.querySelectorAll('[data-qf-setting]').forEach(function (btn) { var k = btn.dataset.qfSetting; var checked = !!settings[k]; btn.classList.toggle('on', checked); btn.setAttribute('aria-pressed', String(checked)); var b = btn.querySelector('b'); if (b)
            b.textContent = checked ? t('settings.on') : t('settings.off'); });
        var v = sheet.querySelector('[data-qf-version]');
        if (v)
            v.textContent = versionText();
    }
    function renderProfileSheet() {
        var _a;
        var sheet = document.getElementById('qf-profile-sheet');
        if (!sheet)
            return;
        var name = (window.AUTH_USER && (window.AUTH_USER.name || window.AUTH_USER.email)) || ((_a = document.getElementById('user-display-name')) === null || _a === void 0 ? void 0 : _a.textContent) || t('profile.login');
        sheet.querySelector('[data-qf-profile-name]').textContent = name;
        sheet.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    }
    function renderDynamicText() {
        document.querySelectorAll('#qf-mobile-bottom-nav [data-i18n], #qf-downloads-sheet [data-i18n], #qf-profile-sheet [data-i18n], #qf-settings-sheet [data-i18n], #qf-update-banner [data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
        renderDownloads();
        renderProfileSheet();
        renderSettingsState();
    }
    function clearAppCache() {
        return __awaiter(this, void 0, void 0, function () {
            var keys, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!('caches' in window)) return [3 /*break*/, 3];
                        return [4 /*yield*/, caches.keys()];
                    case 1:
                        keys = _a.sent();
                        return [4 /*yield*/, Promise.all(keys.map(function (k) { return caches.delete(k); }))];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        localStorage.removeItem(LS_DOWNLOADS);
                        renderDownloads();
                        toast(t('settings.cacheCleared'));
                        return [3 /*break*/, 5];
                    case 4:
                        e_2 = _a.sent();
                        toast(t('settings.cacheError'));
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function enableNotifications(on) {
        return __awaiter(this, void 0, void 0, function () {
            var s, perm, _1, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        s = getSettings();
                        if (!(on && 'Notification' in window)) return [3 /*break*/, 9];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, Notification.requestPermission()];
                    case 2:
                        perm = _a.sent();
                        s.notifications = perm === 'granted';
                        if (!(s.notifications && typeof window.enableSineQPush === 'function')) return [3 /*break*/, 6];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, window.enableSineQPush()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _1 = _a.sent();
                        return [3 /*break*/, 6];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        e_3 = _a.sent();
                        s.notifications = false;
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        if (on) {
                            s.notifications = false;
                            toast(t('settings.notSupported'));
                        }
                        else
                            s.notifications = false;
                        _a.label = 10;
                    case 10:
                        saveSettings(s);
                        renderSettingsState();
                        if (s.notifications)
                            toast(t('settings.saved'));
                        return [2 /*return*/];
                }
            });
        });
    }
    function getReportUserInfo() {
        var _a, _b;
        return {
            userId: localStorage.getItem('userId') || window.USER_ID || 'guest',
            userName: (window.AUTH_USER && (window.AUTH_USER.name || window.AUTH_USER.email)) || ((_a = document.getElementById('user-display-name')) === null || _a === void 0 ? void 0 : _a.textContent) || '',
            userEmail: (window.AUTH_USER && window.AUTH_USER.email) || ((_b = document.getElementById('dd-email')) === null || _b === void 0 ? void 0 : _b.textContent) || '',
            token: localStorage.getItem('token') || window.TOKEN || ''
        };
    }
    function toggleReportForm(force) {
        var form = document.querySelector('[data-qf-report-form]');
        if (!form)
            return;
        var show = typeof force === 'boolean' ? force : form.hidden;
        form.hidden = !show;
        if (show)
            setTimeout(function () { var _a; return (_a = document.getElementById('qf-report-message')) === null || _a === void 0 ? void 0 : _a.focus(); }, 60);
    }
    function submitIssueReport() {
        return __awaiter(this, void 0, void 0, function () {
            var messageEl, statusEl, sendBtn, message, info, headers, body, res, data, contact, e_4;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        messageEl = document.getElementById('qf-report-message');
                        statusEl = document.getElementById('qf-report-status');
                        sendBtn = document.querySelector('[data-qf-report-send]');
                        message = ((messageEl === null || messageEl === void 0 ? void 0 : messageEl.value) || '').trim();
                        if (!message) {
                            if (statusEl)
                                statusEl.textContent = t('report.required');
                            return [2 /*return*/];
                        }
                        if (sendBtn)
                            sendBtn.disabled = true;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, 5, 6]);
                        info = getReportUserInfo();
                        headers = { 'Content-Type': 'application/json' };
                        if (info.token)
                            headers.Authorization = 'Bearer ' + info.token;
                        body = {
                            type: ((_a = document.getElementById('qf-report-type')) === null || _a === void 0 ? void 0 : _a.value) || 'bug',
                            message: message,
                            contact: ((_b = document.getElementById('qf-report-contact')) === null || _b === void 0 ? void 0 : _b.value) || '',
                            pageUrl: location.href,
                            userAgent: navigator.userAgent,
                            userId: info.userId,
                            userName: info.userName,
                            userEmail: info.userEmail
                        };
                        return [4 /*yield*/, fetch('/api/reports', { method: 'POST', headers: headers, body: JSON.stringify(body) })];
                    case 2:
                        res = _c.sent();
                        return [4 /*yield*/, res.json().catch(function () { return ({}); })];
                    case 3:
                        data = _c.sent();
                        if (!res.ok)
                            throw new Error(data.error || 'report failed');
                        if (messageEl)
                            messageEl.value = '';
                        contact = document.getElementById('qf-report-contact');
                        if (contact)
                            contact.value = '';
                        if (statusEl)
                            statusEl.textContent = t('report.sent');
                        toast(t('report.sent'));
                        setTimeout(function () { return toggleReportForm(false); }, 900);
                        return [3 /*break*/, 6];
                    case 4:
                        e_4 = _c.sent();
                        if (statusEl)
                            statusEl.textContent = t('report.error');
                        toast(t('report.error'));
                        return [3 /*break*/, 6];
                    case 5:
                        if (sendBtn)
                            sendBtn.disabled = false;
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    function injectUI() {
        if (document.getElementById('qf-mobile-bottom-nav'))
            return;
        var nav = document.createElement('nav');
        nav.id = 'qf-mobile-bottom-nav';
        nav.className = 'qf-mobile-bottom-nav';
        nav.setAttribute('aria-label', 'APK alt menü');
        nav.innerHTML = "\n      <button class=\"active\" data-qf-tab=\"home\" type=\"button\"><span>\u2302</span><small data-i18n=\"nav.home\">".concat(t('nav.home'), "</small></button>\n      <button data-qf-tab=\"search\" type=\"button\"><span>\u2315</span><small data-i18n=\"nav.search\">").concat(t('nav.search'), "</small></button>\n      <button data-qf-tab=\"downloads\" type=\"button\"><span>\u21E9</span><small data-i18n=\"nav.downloads\">").concat(t('nav.downloads'), "</small></button>\n      <button data-qf-tab=\"favorites\" type=\"button\"><span>\u2661</span><small data-i18n=\"nav.favorites\">").concat(t('nav.favorites'), "</small></button>\n      <button data-qf-tab=\"profile\" type=\"button\"><span>\u25C9</span><small data-i18n=\"nav.profile\">").concat(t('nav.profile'), "</small></button>");
        document.body.appendChild(nav);
        nav.addEventListener('click', function (e) { var btn = e.target.closest('button'); if (!btn)
            return; var tab = btn.dataset.qfTab; setActive(tab); if (tab === 'home') {
            closeDownloads();
            closeProfileSheet();
            closeSettings();
            if (window.showAll)
                window.showAll();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } if (tab === 'search') {
            closeDownloads();
            closeProfileSheet();
            closeSettings();
            openSearch();
        } if (tab === 'downloads')
            openDownloads(); if (tab === 'favorites') {
            closeDownloads();
            closeProfileSheet();
            closeSettings();
            window.loadFavorites ? window.loadFavorites() : toast('Favoriler için giriş yapmalısın.');
        } if (tab === 'profile')
            openProfileSheet(); });
        var downloads = document.createElement('section');
        downloads.id = 'qf-downloads-sheet';
        downloads.className = 'qf-downloads-sheet';
        downloads.innerHTML = '<div class="qf-downloads-head"><h3 data-qf-sheet-title data-i18n="downloads.title">' + t('downloads.title') + '</h3><button class="qf-sheet-close" onclick="qfCloseDownloads()">×</button></div><div data-qf-download-list></div>';
        document.body.appendChild(downloads);
        var profile = document.createElement('section');
        profile.id = 'qf-profile-sheet';
        profile.className = 'qf-profile-sheet qf-mobile-sheet';
        profile.innerHTML = "\n      <div class=\"qf-sheet-grabber\"></div>\n      <div class=\"qf-downloads-head\"><h3 data-i18n=\"profile.title\">".concat(t('profile.title'), "</h3><button class=\"qf-sheet-close\" onclick=\"qfCloseProfileSheet()\">\u00D7</button></div>\n      <div class=\"qf-profile-hero\"><div class=\"qf-profile-avatar\">\u25C9</div><div><small data-i18n=\"profile.account\">").concat(t('profile.account'), "</small><b data-qf-profile-name>").concat(t('profile.login'), "</b></div></div>\n      <button class=\"qf-profile-action primary\" type=\"button\" onclick=\"qfOpenSettings()\" data-i18n=\"settings.open\">").concat(t('settings.open'), "</button>\n      <button class=\"qf-profile-action\" type=\"button\" onclick=\"qfCloseProfileSheet(); window.openProfileSelectScreen ? openProfileSelectScreen() : (function(){var b=document.getElementById('local-auth-btn'); if(b) b.click();})()\" data-i18n=\"profile.switch\">").concat(t('profile.switch'), "</button>\n      <button class=\"qf-profile-action\" type=\"button\" onclick=\"qfCloseProfileSheet(); window.openProfileManageModal ? openProfileManageModal() : null\" data-i18n=\"profile.manage\">").concat(t('profile.manage'), "</button>\n      <button class=\"qf-profile-action\" type=\"button\" onclick=\"qfCloseProfileSheet(); window.loadWatchlist ? loadWatchlist() : null\" data-i18n=\"profile.watchlist\">").concat(t('profile.watchlist'), "</button>");
        document.body.appendChild(profile);
        var settings = document.createElement('section');
        settings.id = 'qf-settings-sheet';
        settings.className = 'qf-settings-sheet qf-mobile-sheet';
        settings.innerHTML = "\n      <div class=\"qf-sheet-grabber\"></div>\n      <div class=\"qf-downloads-head\"><div><h3 data-i18n=\"settings.title\">".concat(t('settings.title'), "</h3><p data-i18n=\"settings.subtitle\">").concat(t('settings.subtitle'), "</p></div><button class=\"qf-sheet-close\" onclick=\"qfCloseSettings()\">\u00D7</button></div>\n      <label class=\"qf-setting-row qf-setting-lang\"><span data-i18n=\"settings.language\">").concat(t('settings.language'), "</span><select data-qf-lang-select aria-label=\"").concat(escapeAttr(t('settings.language')), "\">\n        <option value=\"tr\">T\u00FCrk\u00E7e</option><option value=\"ar\">\u0627\u0644\u0639\u0631\u0628\u064A\u0629</option><option value=\"en\">English</option><option value=\"en-GB\">English UK</option><option value=\"es\">Espa\u00F1ol</option><option value=\"it\">Italiano</option><option value=\"fr\">Fran\u00E7ais</option><option value=\"de\">Deutsch</option><option value=\"ru\">\u0420\u0443\u0441\u0441\u043A\u0438\u0439</option><option value=\"zh\">\u4E2D\u6587</option>\n      </select></label>\n      <div class=\"qf-setting-row\"><span data-i18n=\"settings.autoplay\">").concat(t('settings.autoplay'), "</span>").concat(switchMarkup('autoplay', getSetting('autoplay', true)), "</div>\n      <div class=\"qf-setting-row\"><span data-i18n=\"settings.autoNext\">").concat(t('settings.autoNext'), "</span>").concat(switchMarkup('autoNext', getSetting('autoNext', true)), "</div>\n      <div class=\"qf-setting-row\"><span data-i18n=\"settings.fullscreen\">").concat(t('settings.fullscreen'), "</span>").concat(switchMarkup('tryFullscreen', getSetting('tryFullscreen', true)), "</div>\n      <div class=\"qf-setting-row\"><span data-i18n=\"settings.landscape\">").concat(t('settings.landscape'), "</span>").concat(switchMarkup('tryLandscape', getSetting('tryLandscape', true)), "</div>\n      <div class=\"qf-setting-row\"><span data-i18n=\"settings.notifications\">").concat(t('settings.notifications'), "</span>").concat(switchMarkup('notifications', getSetting('notifications', false)), "</div>\n      <div class=\"qf-report-box\">\n        <button class=\"qf-report-toggle\" type=\"button\" data-qf-report-open data-i18n=\"settings.report\">").concat(t('settings.report'), "</button>\n        <div class=\"qf-report-form\" data-qf-report-form hidden>\n          <label><span data-i18n=\"report.type\">").concat(t('report.type'), "</span><select id=\"qf-report-type\"><option value=\"bug\">").concat(t('report.type.bug'), "</option><option value=\"player\">").concat(t('report.type.player'), "</option><option value=\"account\">").concat(t('report.type.account'), "</option><option value=\"other\">").concat(t('report.type.other'), "</option></select></label>\n          <textarea id=\"qf-report-message\" maxlength=\"2000\" data-i18n-placeholder=\"report.message\" placeholder=\"").concat(escapeAttr(t('report.message')), "\"></textarea>\n          <input id=\"qf-report-contact\" maxlength=\"180\" data-i18n-placeholder=\"report.contact\" placeholder=\"").concat(escapeAttr(t('report.contact')), "\">\n          <div class=\"qf-report-actions\"><button type=\"button\" data-qf-report-send data-i18n=\"report.send\">").concat(t('report.send'), "</button><span id=\"qf-report-status\"></span></div>\n        </div>\n      </div>\n      <button class=\"qf-clear-cache\" type=\"button\" data-i18n=\"settings.clearCache\">").concat(t('settings.clearCache'), "</button>\n      <div class=\"qf-app-version\"><span data-i18n=\"settings.version\">").concat(t('settings.version'), "</span><b data-qf-version>").concat(versionText(), "</b></div>");
        document.body.appendChild(settings);
        settings.querySelector('[data-qf-lang-select]').addEventListener('change', function (e) { return setLanguage(e.target.value); });
        settings.addEventListener('click', function (e) { var sw = e.target.closest('[data-qf-setting]'); if (sw) {
            var key = sw.dataset.qfSetting;
            var next = !getSetting(key, false);
            if (key === 'notifications')
                enableNotifications(next);
            else
                window.qfSetSetting(key, next);
        } if (e.target.closest('.qf-clear-cache'))
            clearAppCache(); if (e.target.closest('[data-qf-report-open]'))
            toggleReportForm(); if (e.target.closest('[data-qf-report-send]'))
            submitIssueReport(); });
        var banner = document.createElement('div');
        banner.id = 'qf-update-banner';
        banner.className = 'qf-update-banner';
        banner.innerHTML = '<div style="flex:1"><strong data-i18n="update.title">' + t('update.title') + '</strong><p data-qf-update-msg data-i18n="update.message">' + t('update.message') + '</p></div><a data-qf-update-link href="#" target="_blank" rel="noopener" data-i18n="update.action">' + t('update.action') + '</a><button type="button" data-qf-update-close data-i18n="update.later">' + t('update.later') + '</button>';
        document.body.appendChild(banner);
        banner.querySelector('[data-qf-update-close]').onclick = function () { localStorage.setItem(LS_DISMISSED, banner.dataset.build || ''); banner.classList.remove('show'); };
        loadVersion();
        renderDynamicText();
    }
    function checkUpdate() {
        return __awaiter(this, void 0, void 0, function () { var res, data, dismissed, build, b, a, e_5; return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' })];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        return [2 /*return*/];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _a.sent();
                    if (!data.apkRequired && !data.apkUrl)
                        return [2 /*return*/];
                    dismissed = localStorage.getItem(LS_DISMISSED);
                    build = String(data.build || data.version || '');
                    if (dismissed === build)
                        return [2 /*return*/];
                    b = document.getElementById('qf-update-banner');
                    if (!b)
                        return [2 /*return*/];
                    b.dataset.build = build;
                    b.querySelector('[data-qf-update-msg]').textContent = data.message || t('update.message');
                    a = b.querySelector('[data-qf-update-link]');
                    if (data.apkUrl) {
                        a.href = data.apkUrl;
                        a.style.display = 'inline-block';
                    }
                    else {
                        a.style.display = 'none';
                    }
                    b.classList.add('show');
                    return [3 /*break*/, 4];
                case 3:
                    e_5 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        }); });
    }
    function enhanceInstallTip() {
        var _this = this;
        var deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', function (e) { if (localStorage.getItem('qf_install_tip_closed'))
            return; e.preventDefault(); deferredPrompt = e; var oldTip = document.querySelector('.qf-install-tip'); if (oldTip)
            oldTip.remove(); var tip = document.createElement('div'); tip.className = 'qf-install-tip show'; tip.innerHTML = '<button>' + t('install.close') + '</button>' + t('install.tip'); document.body.appendChild(tip); tip.onclick = function (ev) { return __awaiter(_this, void 0, void 0, function () { var _2; return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ev.target.tagName === 'BUTTON') {
                        localStorage.setItem('qf_install_tip_closed', '1');
                        tip.remove();
                        return [2 /*return*/];
                    }
                    if (!deferredPrompt) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    deferredPrompt.prompt();
                    return [4 /*yield*/, deferredPrompt.userChoice];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _2 = _a.sent();
                    return [3 /*break*/, 4];
                case 4:
                    deferredPrompt = null;
                    tip.remove();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        }); }); }; });
    }
    function keepScreenAwake() {
        var _this = this;
        document.addEventListener('click', function (e) { return __awaiter(_this, void 0, void 0, function () { var _a, _3; return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!e.target.closest('.btn-play,.card,.ep-card,#fullscreen-btn,.landscape-start'))
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    if (!('wakeLock' in navigator && !window.qfWakeLock)) return [3 /*break*/, 3];
                    _a = window;
                    return [4 /*yield*/, navigator.wakeLock.request('screen')];
                case 2:
                    _a.qfWakeLock = _b.sent();
                    window.qfWakeLock.addEventListener('release', function () { return window.qfWakeLock = null; });
                    _b.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    _3 = _b.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        }); }); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible')
            window.qfWakeLock = null; });
    }
    function modalIsVisible(el) { if (!el)
        return false; var cs = getComputedStyle(el); return el.classList.contains('open') || (cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0 && el.getBoundingClientRect().height > 80); }
    function setBottomNavHidden(hide) { var nav = document.getElementById('qf-mobile-bottom-nav'); document.body.classList.toggle('qf-hide-bottom-nav', !!hide); if (nav) {
        nav.style.display = hide ? 'none' : '';
        nav.style.pointerEvents = hide ? 'none' : '';
    } document.body.style.paddingBottom = hide ? '0' : ''; }
    window.qfSetBottomNavHidden = setBottomNavHidden;
    function syncBottomNavVisibility() { var detailOpen = modalIsVisible(document.getElementById('detail-modal')); var playerOpen = modalIsVisible(document.getElementById('player-modal')); setBottomNavHidden(!!(detailOpen || playerOpen)); }
    function observeModalState() { syncBottomNavVisibility(); ['detail-modal', 'player-modal'].forEach(function (id) { var el = document.getElementById(id); if (!el || el._qfNavObserver)
        return; el._qfNavObserver = true; new MutationObserver(syncBottomNavVisibility).observe(el, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] }); }); var wrap = function (name, after) { var fn = window[name]; if (typeof fn === 'function' && !fn._qfWrapped) {
        window[name] = function () { var r = fn.apply(this, arguments); setTimeout(after, 0); setTimeout(syncBottomNavVisibility, 80); return r; };
        window[name]._qfWrapped = true;
    } }; wrap('openDetail', function () { return setBottomNavHidden(true); }); wrap('closeDetailModal', function () { return setBottomNavHidden(false); }); wrap('openPlayerShell', function () { return setBottomNavHidden(true); }); wrap('closePlayer', function () { return setBottomNavHidden(false); }); document.addEventListener('click', function () { return setTimeout(syncBottomNavVisibility, 0); }, true); window.addEventListener('popstate', function () { return setTimeout(syncBottomNavVisibility, 0); }); }
    function overrideDownload() { var original = window.downloadItem; window.downloadItem = function (type, itemId, videoUrl, title) { var _a, _b, _c, _d; if (!videoUrl && ((_d = (_c = (_b = (_a = window.currentSeries) === null || _a === void 0 ? void 0 : _a.seasons) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.episodes) === null || _d === void 0 ? void 0 : _d[0]))
        videoUrl = window.currentSeries.seasons[0].episodes[0].videoUrl; if (!canDirectDownload(videoUrl)) {
        toast(t('download.unsupported'));
        return;
    } registerDownload({ title: title || 'Video', url: videoUrl, type: type }); if (original)
        return original.apply(this, arguments); var a = document.createElement('a'); a.href = videoUrl; a.download = (title || 'video') + '.mp4'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); toast(t('download.started')); }; }
    document.addEventListener('qf-lang-changed', renderDynamicText);
    ready(function () { document.body.classList.add('qf-apk-mode'); injectUI(); observeModalState(); checkUpdate(); enhanceInstallTip(); keepScreenAwake(); setTimeout(overrideDownload, 300); var action = new URLSearchParams(location.search).get('action'); if (action === 'downloads')
        setTimeout(openDownloads, 350); if (action === 'search')
        setTimeout(openSearch, 350); window.addEventListener('online', function () { return toast(t('toast.online')); }); window.addEventListener('offline', function () { return toast(t('toast.offline')); }); });
})();
// SineQ APK update + content notification guard
(function () {
    'use strict';
    var VERSION_URL = '/version.json';
    var LATEST_CONTENT_URL = '/api/content/latest';
    var LS_BUILD = 'qf_last_seen_build';
    var LS_UPDATE_RELOADED = 'qf_update_reloaded_build';
    var LS_LATEST_CONTENT = 'qf_latest_content_id';
    var LS_SETTINGS = 'sineq_settings';
    var CHECK_INTERVAL = 5 * 60 * 1000;
    function ready(fn) {
        document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
    }
    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') || {};
        }
        catch (_) {
            return {};
        }
    }
    function notificationsEnabled() {
        return !!getSettings().notifications;
    }
    function toast(message) {
        if (window.qfToast)
            return window.qfToast(message);
        var el = document.querySelector('.qf-apk-toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'qf-apk-toast';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(function () { return el.classList.remove('show'); }, 3500);
    }
    function sendLocalNotification(title, body, url) {
        return __awaiter(this, void 0, void 0, function () {
            var permission, options, reg, n_1, _4;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        toast(body || title);
                        if (!notificationsEnabled())
                            return [2 /*return*/];
                        if (!('Notification' in window))
                            return [2 /*return*/];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 8, , 9]);
                        permission = Notification.permission;
                        if (!(permission === 'default')) return [3 /*break*/, 3];
                        return [4 /*yield*/, Notification.requestPermission()];
                    case 2:
                        permission = _c.sent();
                        _c.label = 3;
                    case 3:
                        if (permission !== 'granted')
                            return [2 /*return*/];
                        options = {
                            body: body || '',
                            tag: 'sineq-' + String(title || '').toLowerCase().replace(/\s+/g, '-'),
                            renotify: true,
                            data: { url: url || '/' },
                            icon: '/assets/icons/icon-192.png',
                            badge: '/assets/icons/icon-96.png'
                        };
                        return [4 /*yield*/, ((_b = (_a = navigator.serviceWorker) === null || _a === void 0 ? void 0 : _a.ready) === null || _b === void 0 ? void 0 : _b.catch(function () { return null; }))];
                    case 4:
                        reg = _c.sent();
                        if (!(reg && reg.showNotification)) return [3 /*break*/, 6];
                        return [4 /*yield*/, reg.showNotification(title, options)];
                    case 5:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        n_1 = new Notification(title, options);
                        n_1.onclick = function () { window.focus(); if (url)
                            location.href = url; n_1.close(); };
                        _c.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        _4 = _c.sent();
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    }
    function clearStaticCaches() {
        return __awaiter(this, void 0, void 0, function () {
            var keys, _5;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        if (!('caches' in window)) return [3 /*break*/, 3];
                        return [4 /*yield*/, caches.keys()];
                    case 1:
                        keys = _b.sent();
                        return [4 /*yield*/, Promise.all(keys.map(function (key) { return caches.delete(key); }))];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        if ((_a = navigator.serviceWorker) === null || _a === void 0 ? void 0 : _a.controller) {
                            navigator.serviceWorker.controller.postMessage({ type: 'QF_CLEAR_OLD_CACHES' });
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        _5 = _b.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function showUpdatingOverlay(message) {
        var el = document.getElementById('qf-auto-update-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'qf-auto-update-overlay';
            el.innerHTML = '<div><b>SineQ güncelleniyor</b><p></p></div>';
            document.body.appendChild(el);
        }
        var p = el.querySelector('p');
        if (p)
            p.textContent = message || 'Yeni sürüm hazırlanıyor. Depolama sıfırlamadan yenileniyor.';
        el.classList.add('show');
    }
    function fetchJson(url) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error('HTTP ' + res.status);
                        return [2 /*return*/, res.json()];
                }
            });
        });
    }
    function checkVersionChange() {
        return __awaiter(this, void 0, void 0, function () {
            var data, build, oldBuild, alreadyReloadedFor, _6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fetchJson(VERSION_URL)];
                    case 1:
                        data = _a.sent();
                        build = String(data.build || data.version || '').trim();
                        if (!build)
                            return [2 /*return*/];
                        oldBuild = localStorage.getItem(LS_BUILD);
                        alreadyReloadedFor = localStorage.getItem(LS_UPDATE_RELOADED);
                        if (!oldBuild) {
                            localStorage.setItem(LS_BUILD, build);
                            return [2 /*return*/];
                        }
                        if (!(oldBuild !== build)) return [3 /*break*/, 4];
                        localStorage.setItem(LS_BUILD, build);
                        return [4 /*yield*/, sendLocalNotification('SineQ güncellendi', data.message || 'Yeni sürüm geldi. Uygulama yenileniyor.', '/')];
                    case 2:
                        _a.sent();
                        if (!(alreadyReloadedFor !== build)) return [3 /*break*/, 4];
                        localStorage.setItem(LS_UPDATE_RELOADED, build);
                        showUpdatingOverlay(data.message);
                        return [4 /*yield*/, clearStaticCaches()];
                    case 3:
                        _a.sent();
                        setTimeout(function () { return location.reload(); }, 900);
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        _6 = _a.sent();
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    function normalizeSeriesPayload(payload) {
        if (payload && payload.content)
            return payload.content;
        var list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.series) ? payload.series : []);
        return list[0] || null;
    }
    function checkNewContent() {
        return __awaiter(this, void 0, void 0, function () {
            var latest, _a, id, old, type, title, seriesTitle, _7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        _a = normalizeSeriesPayload;
                        return [4 /*yield*/, fetchJson(LATEST_CONTENT_URL)];
                    case 1:
                        latest = _a.apply(void 0, [_b.sent()]);
                        if (!latest)
                            return [2 /*return*/];
                        id = String(latest._id || latest.id || latest.slug || latest.title || '').trim();
                        if (!id)
                            return [2 /*return*/];
                        old = localStorage.getItem(LS_LATEST_CONTENT);
                        if (!old) {
                            localStorage.setItem(LS_LATEST_CONTENT, id);
                            return [2 /*return*/];
                        }
                        if (!(old !== id)) return [3 /*break*/, 3];
                        localStorage.setItem(LS_LATEST_CONTENT, id);
                        type = latest.kind === 'episode' ? 'bölüm' : (latest.type === 'movie' ? 'film' : 'içerik');
                        title = latest.title || latest.name || 'Yeni içerik';
                        seriesTitle = latest.seriesTitle ? latest.seriesTitle + ' • ' : '';
                        return [4 /*yield*/, sendLocalNotification('Yeni ' + type + ' eklendi', seriesTitle + title + ' artık SineQ’te.', '/')];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        _7 = _b.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function startChecks() {
        checkVersionChange();
        setTimeout(checkNewContent, 2500);
        setInterval(function () {
            if (document.hidden)
                return;
            checkVersionChange();
            checkNewContent();
        }, CHECK_INTERVAL);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                checkVersionChange();
                checkNewContent();
            }
        });
    }
    ready(startChecks);
})();
