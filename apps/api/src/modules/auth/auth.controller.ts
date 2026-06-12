import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../middleware/authenticate';
import { loginSchema } from './auth.schema';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const { accessToken, refreshToken, user } = await authService.login(username, password);

      res
        .cookie('accessToken', accessToken, authService.cookieOptions.access)
        .cookie('refreshToken', refreshToken, authService.cookieOptions.refresh)
        .json({ user });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) return res.status(401).json({ error: 'No refresh token' });

      const { accessToken, refreshToken } = await authService.refresh(token);

      res
        .cookie('accessToken', accessToken, authService.cookieOptions.access)
        .cookie('refreshToken', refreshToken, authService.cookieOptions.refresh)
        .json({ message: 'Tokens refreshed' });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response) {
    res
      .clearCookie('accessToken')
      .clearCookie('refreshToken')
      .json({ message: 'Logged out successfully' });
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
};
