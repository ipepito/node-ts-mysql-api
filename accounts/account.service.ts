import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { db } from '../_helpers/db';
import { Role } from '../_helpers/role';
import { sendEmail } from '../_helpers/send-email';
const config = require('../config.json');

export const accountService = {
  authenticate, refreshToken, revokeToken,
  register, verifyEmail,
  forgotPassword, validateResetToken, resetPassword,
  getAll, getById, create, update, delete: _delete
};

// ─── Auth ────────────────────────────────────────────────
async function authenticate({ email, password, ipAddress }: any) {
  const account = await db.Account.scope('withHash').findOne({ where: { email } });
  if (!account || !account.isVerified || !bcrypt.compareSync(password, account.passwordHash))
    throw 'Email or password is incorrect';

  const token = generateJwt(account);
  const refresh = await generateRefreshToken(account, ipAddress);
  await refresh.save();

  return { ...basicDetails(account), jwtToken: token, refreshToken: refresh.token };
}

async function refreshToken({ token, ipAddress }: any) {
  const refresh = await getRefreshToken(token);
  const account = await refresh.getAccount();

  const newRefresh = await generateRefreshToken(account, ipAddress);
  refresh.revoked = new Date();
  refresh.revokedByIp = ipAddress;
  refresh.replacedByToken = newRefresh.token;
  await refresh.save();
  await newRefresh.save();

  const jwtToken = generateJwt(account);
  return { ...basicDetails(account), jwtToken, refreshToken: newRefresh.token };
}

async function revokeToken({ token, ipAddress }: any) {
  const refresh = await getRefreshToken(token);
  refresh.revoked = new Date();
  refresh.revokedByIp = ipAddress;
  await refresh.save();
}

// ─── Registration ────────────────────────────────────────
async function register(params: any, origin: string) {
  const exists = await db.Account.findOne({ where: { email: params.email } });
  if (exists) {
    await sendAlreadyRegisteredEmail(params.email, origin);
    return;
  }

  const account: any = new db.Account(params);
  const isFirst = (await db.Account.count()) === 0;
  account.role = isFirst ? Role.Admin : Role.User;
  account.verificationToken = randomToken();
  account.created = new Date();
  account.passwordHash = bcrypt.hashSync(params.password, 10);
  await account.save();

  await sendEmail({
        to: params.email,
        subject: 'Sign-up Verification API - Verify Email',
        html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>`
    });


  await sendVerificationEmail(account, origin);

 
}

async function verifyEmail({ token }: any) {
  const account = await db.Account.findOne({ where: { verificationToken: token } });
  if (!account) throw 'Verification failed';
  account.verified = new Date();
  account.verificationToken = null;
  await account.save();
}

async function forgotPassword({ email }: any, origin: string) {
  const account = await db.Account.findOne({ where: { email } });
  if (!account) return;
  account.resetToken = randomToken();
  account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await account.save();
  await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }: any) {
  const account = await db.Account.findOne({
    where: { resetToken: token, resetTokenExpires: { [Op.gt]: new Date() } }
  });
  if (!account) throw 'Invalid token';
  return account;
}

async function resetPassword({ token, password }: any) {
  const account = await validateResetToken({ token });
  account.passwordHash = bcrypt.hashSync(password, 10);
  account.passwordReset = new Date();
  account.resetToken = null;
  account.resetTokenExpires = null;
  await account.save();
}

// ─── CRUD ────────────────────────────────────────────────
async function getAll() {
  const accounts = await db.Account.findAll();
  return accounts.map(basicDetails);
}

async function getById(id: number) {
  const account = await getAccount(id);
  return basicDetails(account);
}

async function create(params: any) {
  if (await db.Account.findOne({ where: { email: params.email } }))
    throw `Email "${params.email}" is already registered`;
  const account: any = new db.Account(params);
  account.created = new Date();
  account.verified = new Date();
  account.passwordHash = bcrypt.hashSync(params.password, 10);
  await account.save();
  return basicDetails(account);
}

async function update(id: number, params: any) {
  const account = await getAccount(id);
  if (params.email && params.email !== account.email &&
    await db.Account.findOne({ where: { email: params.email } }))
    throw `Email "${params.email}" is already taken`;
  if (params.password) params.passwordHash = bcrypt.hashSync(params.password, 10);
  Object.assign(account, params);
  account.updated = new Date();
  await account.save();
  return basicDetails(account);
}

async function _delete(id: number) {
  const account = await getAccount(id);
  await account.destroy();
}

// ─── Helpers ─────────────────────────────────────────────
async function getAccount(id: number) {
  const account = await db.Account.findByPk(id);
  if (!account) throw 'Account not found';
  return account;
}

async function getRefreshToken(token: string) {
  const refresh = await db.RefreshToken.findOne({ where: { token } });
  if (!refresh || !refresh.isActive) throw 'Invalid token';
  return refresh;
}

function generateJwt(account: any) {
  return jwt.sign({ sub: account.id, id: account.id, role: account.role }, config.secret, { expiresIn: '15m' });
}

async function generateRefreshToken(account: any, ipAddress: string) {
  return new db.RefreshToken({
    accountId: account.id,
    token: randomToken(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress
  });
}

function randomToken() { return crypto.randomBytes(40).toString('hex'); }

function basicDetails(account: any) {
  const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
  return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

async function sendVerificationEmail(account: any, origin: string) {
  const verifyUrl = `${origin}/accounts/verify-email?token=${account.verificationToken}`;
  await sendEmail({
    to: account.email,
    subject: 'Sign-up Verification - Verify Email',
    html: `<p>Please click the link to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
  });
}

async function sendAlreadyRegisteredEmail(email: string, origin: string) {
  await sendEmail({
    to: email,
    subject: 'Email Already Registered',
    html: `<p>Your email <strong>${email}</strong> is already registered. <a href="${origin}/accounts/forgot-password">Forgot password?</a></p>`
  });
}

async function sendPasswordResetEmail(account: any, origin: string) {
  const resetUrl = `${origin}/accounts/reset-password?token=${account.resetToken}`;
  await sendEmail({
    to: account.email,
    subject: 'Reset Password',
    html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  });
}