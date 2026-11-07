/* ════════════════════════════════════════════════════════════════
   Account forms: one set of rules for every signup form —
   the public /signup page (index.html auSignup), the app's auth screen
   (js/auth.js handleSignUp) and the in-app guest sign-up (js/guest.js
   _ggDoSignup).

   The rules and messages are the server's (oriven-backend
   services/accounts.js validateSignup): one specific reason per field, in
   form order, so a field that is filled in is never reported as missing.

   Autofill: browsers can show a value they filled in (often the password)
   without giving it to the page until the person interacts with it. Such a
   field reads as empty; instead of "required" the person is told to click
   into it once.
   ════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  var MSG = {
    firstName: 'Enter your first name.',
    firstNameLong: 'Your first name can be at most 80 characters.',
    lastName: 'Enter your last name.',
    lastNameLong: 'Your last name can be at most 80 characters.',
    email: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address.',
    password: 'Choose a password.',
    passwordShort: 'Your password needs at least 6 characters.',
    passwordLong: 'That password is too long (200 characters at most).',
    passwordConfirm: 'The passwords don’t match.',
    autofill: 'Your browser filled this in but hasn’t passed it on yet. Click into the field once, then try again.',
    exists: 'An account with this email address already exists. Please sign in or reset your password.',
  };

  function normalizeEmail(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }

  // { value, autofillHidden } for an input id (missing element → empty).
  function read(id) {
    var el = root.document && root.document.getElementById(id);
    if (!el) return { value: '', autofillHidden: false };
    var v = el.value || '';
    var hidden = false;
    if (!v) { try { hidden = el.matches(':autofill') || el.matches(':-webkit-autofill'); } catch (_) { try { hidden = el.matches(':-webkit-autofill'); } catch (__) {} } }
    return { value: v, autofillHidden: hidden };
  }

  // f: { firstName, lastName, email, password, passwordConfirm? } (strings),
  // opts: { requireLastName, confirm, hidden: { field: true } }.
  // → { ok: true, value } | { ok: false, field, message }
  function validate(f, opts) {
    opts = opts || {};
    var hidden = opts.hidden || {};
    var s = function (v) { return typeof v === 'string' ? v.trim() : ''; };
    var firstName = s(f.firstName), lastName = s(f.lastName), email = normalizeEmail(f.email), password = typeof f.password === 'string' ? f.password : '';
    var bad = function (field, message) { return { ok: false, field: field, message: message }; };
    if (!firstName) return bad('firstName', hidden.firstName ? MSG.autofill : MSG.firstName);
    if (firstName.length > 80) return bad('firstName', MSG.firstNameLong);
    if (opts.requireLastName && !lastName) return bad('lastName', hidden.lastName ? MSG.autofill : MSG.lastName);
    if (lastName.length > 80) return bad('lastName', MSG.lastNameLong);
    if (!email) return bad('email', hidden.email ? MSG.autofill : MSG.email);
    if (!EMAIL_RE.test(email)) return bad('email', MSG.emailInvalid);
    if (!password) return bad('password', hidden.password ? MSG.autofill : MSG.password);
    if (password.length < 6) return bad('password', MSG.passwordShort);
    if (password.length > 200) return bad('password', MSG.passwordLong);
    if (opts.confirm && f.passwordConfirm !== password) return bad('passwordConfirm', MSG.passwordConfirm);
    return { ok: true, value: { firstName: firstName, lastName: lastName, email: email, password: password } };
  }

  // What to show for a failed /api/signup (apiFetch result) or a thrown
  // error: the server's own specific message, never a guessed "missing
  // fields". → { message, field }
  function signupError(resOrErr) {
    var d = resOrErr && resOrErr.data, msg = '', code = '', field = null;
    if (d && typeof d === 'object') { msg = d.error || ''; code = d.code || ''; field = d.field || null; }
    else if (resOrErr && resOrErr.message) msg = resOrErr.message;
    if (code === 'EMAIL_EXISTS' || /already (been )?registered|already exists|already in use/i.test(msg)) return { message: MSG.exists, field: 'email' };
    if (/network|failed to fetch|could not reach/i.test(msg)) return { message: 'Connection error. Please check your internet and try again.', field: null };
    if (/too many/i.test(msg)) return { message: 'Too many attempts. Please wait a moment and try again.', field: null };
    return { message: msg || 'We couldn’t create your account right now. Please try again.', field: field };
  }

  var api = { normalizeEmail: normalizeEmail, read: read, validate: validate, signupError: signupError, MESSAGES: MSG, EMAIL_RE: EMAIL_RE };
  root.orvAccountForms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
