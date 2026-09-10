/* ============================================================================
 * FOYDALANUVCHILAR VA SESSIYA
 *   rol: 'bosh'  — bosh admin (hamma narsa + adminlarni boshqarish)
 *        'admin' — oddiy admin (tahrirlaydi, lekin adminlarni boshqara olmaydi)
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store.js');

const SESSION_SOAT = 12;
const SECRET_FILE = path.join(store.DATA_DIR, '.session-secret');

/* Sessiya kaliti — birinchi ishga tushishda yaratiladi va saqlanadi */
function sessiyaKaliti() {
  try {
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    const kalit = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, kalit, 'utf8');
    return kalit;
  } catch (e) {
    console.error('Sessiya kaliti saqlanmadi (xotirada ishlaydi):', e.message);
    return crypto.randomBytes(48).toString('hex');
  }
}
const KALIT = sessiyaKaliti();

/* ------------------------------------------------------------ parol hashi */
function parolHash(parol, tuz) {
  const salt = tuz || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(parol), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function parolTogrimi(parol, saqlangan) {
  try {
    const [salt, hash] = String(saqlangan || '').split(':');
    if (!salt || !hash) return false;
    const yangi = crypto.scryptSync(String(parol), salt, 64).toString('hex');
    const a = Buffer.from(yangi, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

/* --------------------------------------------------- birinchi bosh admin */
function boshAdminYarat(login, parol) {
  const users = store.usersOl();
  if (users.length) return null;
  if (!login || !parol) return null;

  const user = {
    id: 'u' + Date.now().toString(36),
    login: String(login).toLowerCase().trim(),
    parol: parolHash(parol),
    rol: 'bosh',
    yaratilgan: new Date().toISOString(),
    oxirgiKirish: null
  };
  store.usersSaqla([user]);
  console.log(`✅ Bosh admin yaratildi: ${user.login}`);
  return user;
}

function userTop(login) {
  const l = String(login || '').toLowerCase().trim();
  return store.usersOl().find((u) => u.login === l) || null;
}

function userTopId(id) {
  return store.usersOl().find((u) => u.id === id) || null;
}

/* ---------------------------------------------------------------- sessiya */
function imzo(matn) {
  return crypto.createHmac('sha256', KALIT).update(matn).digest('hex');
}

function tokenYarat(userId) {
  const exp = Date.now() + SESSION_SOAT * 3600 * 1000;
  const asos = userId + '.' + exp;
  return asos + '.' + imzo(asos);
}

function tokenTekshir(token) {
  if (!token) return null;
  const qismlar = String(token).split('.');
  if (qismlar.length !== 3) return null;
  const [userId, exp, sig] = qismlar;

  const kutilgan = imzo(userId + '.' + exp);
  if (sig.length !== kutilgan.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(kutilgan))) return null;
  if (Number(exp) < Date.now()) return null;

  return userTopId(userId);
}

function cookieOl(req, nom) {
  const raw = req.headers.cookie || '';
  for (const qism of raw.split(';')) {
    const i = qism.indexOf('=');
    if (i === -1) continue;
    if (qism.slice(0, i).trim() === nom) return decodeURIComponent(qism.slice(i + 1).trim());
  }
  return null;
}

function joriyUser(req) {
  return tokenTekshir(cookieOl(req, 'xt_sessiya'));
}

function cookieMatn(token, https) {
  const secure = https ? ' Secure;' : '';
  return `xt_sessiya=${token}; HttpOnly;${secure} Path=/; Max-Age=${SESSION_SOAT * 3600}; SameSite=Strict`;
}

const cookieOchir = 'xt_sessiya=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict';

/* ------------------------------------------------- parolni tez terishdan */
const urinishlar = new Map();

function urinishMumkinmi(ip) {
  const u = urinishlar.get(ip);
  return !u || u.bloklangan <= Date.now();
}

function urinishQayd(ip, muvaffaqiyat) {
  if (muvaffaqiyat) { urinishlar.delete(ip); return; }
  const u = urinishlar.get(ip) || { son: 0, bloklangan: 0 };
  u.son++;
  if (u.son >= 8) { u.bloklangan = Date.now() + 10 * 60 * 1000; u.son = 0; }
  urinishlar.set(ip, u);
}

/* -------------------------------------------------------------- yordamchi */
function parolYetarlimi(parol) {
  const p = String(parol || '');
  if (p.length < 8) return 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak';
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return 'Parolda harf ham, raqam ham bo\'lishi kerak';
  return null;
}

function loginTogrimi(login) {
  const l = String(login || '').toLowerCase().trim();
  if (!/^[a-z0-9_.-]{3,24}$/.test(l)) {
    return 'Login 3–24 ta belgi: kichik harflar, raqamlar, _ . - ';
  }
  return null;
}

module.exports = {
  parolHash, parolTogrimi, parolYetarlimi, loginTogrimi,
  boshAdminYarat, userTop, userTopId,
  tokenYarat, joriyUser, cookieMatn, cookieOchir,
  urinishMumkinmi, urinishQayd
};
