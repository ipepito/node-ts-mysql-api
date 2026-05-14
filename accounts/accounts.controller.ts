import express, { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { accountService } from './account.service';
import { authorize } from '../_middleware/authorize';
import { validateRequest } from '../_middleware/validate-request';
import { Role } from '../_helpers/role';

const router = express.Router();

// Routes
router.post('/authenticate',   authenticateSchema,  authenticate);
router.post('/refresh-token',  refreshToken);
router.post('/revoke-token',   authorize(), revokeTokenSchema, revokeToken);
router.post('/register',       registerSchema, register);
router.post('/verify-email',   verifyEmailSchema, verifyEmail);
router.post('/forgot-password',forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/',                authorize(Role.Admin), getAll);
router.get('/:id',             authorize(), getById);
router.post('/',               authorize(Role.Admin), createSchema, create);
router.put('/:id',             authorize(), updateSchema, update);
router.delete('/:id',          authorize(), _delete);

export default router;

// ─── Schema Middleware ────────────────────────────────────
function authenticateSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({ email: Joi.string().required(), password: Joi.string().required() });
  validateRequest(req, next, schema);
}
function registerSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    title: Joi.string().required(), firstName: Joi.string().required(),
    lastName: Joi.string().required(), email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    acceptTerms: Joi.boolean().valid(true).required()
  });
  validateRequest(req, next, schema);
}
function verifyEmailSchema(req: Request, res: Response, next: NextFunction) {
  validateRequest(req, next, Joi.object({ token: Joi.string().required() }));
}
function forgotPasswordSchema(req: Request, res: Response, next: NextFunction) {
  validateRequest(req, next, Joi.object({ email: Joi.string().email().required() }));
}
function validateResetTokenSchema(req: Request, res: Response, next: NextFunction) {
  validateRequest(req, next, Joi.object({ token: Joi.string().required() }));
}
function resetPasswordSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    token: Joi.string().required(), password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
  });
  validateRequest(req, next, schema);
}
function revokeTokenSchema(req: Request, res: Response, next: NextFunction) {
  validateRequest(req, next, Joi.object({ token: Joi.string().empty('') }));
}
function createSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    title: Joi.string().required(), firstName: Joi.string().required(),
    lastName: Joi.string().required(), email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    role: Joi.string().valid(Role.Admin, Role.User).required()
  });
  validateRequest(req, next, schema);
}
function updateSchema(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object({
    title: Joi.string().empty(''), firstName: Joi.string().empty(''),
    lastName: Joi.string().empty(''), email: Joi.string().email().empty(''),
    password: Joi.string().min(6).empty(''),
    confirmPassword: Joi.string().valid(Joi.ref('password')).empty(''),
    role: Joi.string().valid(Role.Admin, Role.User).empty('')
  });
  validateRequest(req, next, schema);
}

// ─── Route Handlers ───────────────────────────────────────
function authenticate(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  const ipAddress = req.ip!;
  accountService.authenticate({ email, password, ipAddress })
    .then(({ refreshToken, ...account }) => {
      setTokenCookie(res, refreshToken);
      res.json(account);
    }).catch(next);
}
function refreshToken(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.refreshToken;
  const ipAddress = req.ip!;
  accountService.refreshToken({ token, ipAddress })
    .then(({ refreshToken, ...account }) => {
      setTokenCookie(res, refreshToken);
      res.json(account);
    }).catch(next);
}
function revokeToken(req: any, res: Response, next: NextFunction) {
  const token = req.body.token || req.cookies.refreshToken;
  const ipAddress = req.ip!;
  if (!token) return res.status(400).json({ message: 'Token is required' });
  if (!req.user.ownsToken(token) && req.user.role !== Role.Admin)
    return res.status(401).json({ message: 'Unauthorized' });
  accountService.revokeToken({ token, ipAddress })
    .then(() => res.json({ message: 'Token revoked' })).catch(next);
}
function register(req: Request, res: Response, next: NextFunction) {
  accountService.register(req.body, req.get('origin') || `http://localhost:4000`)
    .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
    .catch(next);
}
function verifyEmail(req: Request, res: Response, next: NextFunction) {
  accountService.verifyEmail(req.body)
    .then(() => res.json({ message: 'Verification successful, you can now login' })).catch(next);
}
function forgotPassword(req: Request, res: Response, next: NextFunction) {
  accountService.forgotPassword(req.body, req.get('origin') || `http://localhost:4000`)
    .then(() => res.json({ message: 'Please check your email for password reset instructions' })).catch(next);
}
function validateResetToken(req: Request, res: Response, next: NextFunction) {
  accountService.validateResetToken(req.body)
    .then(() => res.json({ message: 'Token is valid' })).catch(next);
}
function resetPassword(req: Request, res: Response, next: NextFunction) {
  accountService.resetPassword(req.body)
    .then(() => res.json({ message: 'Password reset successful, you can now login' })).catch(next);
}
function getAll(req: Request, res: Response, next: NextFunction) {
  accountService.getAll().then(res.json.bind(res)).catch(next);
}
function getById(req: any, res: Response, next: NextFunction) {
  if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin)
    return res.status(401).json({ message: 'Unauthorized' });
  accountService.getById(Number(req.params.id)).then(res.json.bind(res)).catch(next);
}
function create(req: Request, res: Response, next: NextFunction) {
  accountService.create(req.body).then(res.json.bind(res)).catch(next);
}
function update(req: any, res: Response, next: NextFunction) {
  if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin)
    return res.status(401).json({ message: 'Unauthorized' });
  accountService.update(Number(req.params.id), req.body).then(res.json.bind(res)).catch(next);
}
function _delete(req: any, res: Response, next: NextFunction) {
  if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin)
    return res.status(401).json({ message: 'Unauthorized' });
  accountService.delete(Number(req.params.id))
    .then(() => res.json({ message: 'Account deleted successfully' })).catch(next);
}

function setTokenCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true, expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), sameSite: 'strict'
  });
}