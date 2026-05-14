import { Response, NextFunction } from 'express';
import { expressjwt } from 'express-jwt';
import { db } from '../_helpers/db';
const config = require('../config.json');

export function authorize(roles: string[] | string = []) {
  if (typeof roles === 'string') roles = [roles];

  return [
    expressjwt({ secret: config.secret, algorithms: ['HS256'] }),

    async (req: any, res: Response, next: NextFunction) => {
      const account = await db.Account.findByPk(req.auth.id);
      const refreshTokens = await db.RefreshToken.findAll({ where: { accountId: req.auth.id } });

      if (!account || (roles.length && !roles.includes(account.role))) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      req.user = req.auth;
      req.user.role = account.role;
      req.user.ownsToken = (token: string) => !!refreshTokens.find((x: any) => x.token === token);
      next();
    }
  ];
}