import { Response, NextFunction } from 'express';
import { tripsService } from './trips.service';
import { AuthRequest } from '../../middleware/authenticate';
import { createTripSchema, updateTripSchema, tripStatusSchema } from './trips.schema';
import { TripStatus } from '@prisma/client';

export const tripsController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { vehicleId, driverId, status } = req.query;
      const trips = await tripsService.findAll({
        vehicleId: vehicleId ? Number(vehicleId) : undefined,
        driverId: driverId ? Number(driverId) : undefined,
        status: status as TripStatus | undefined,
      });
      res.json(trips);
    } catch (err) { next(err); }
  },

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trip = await tripsService.findById(Number(req.params.id));
      res.json(trip);
    } catch (err) { next(err); }
  },

  async tracking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trip = await tripsService.findByTrackingCode(req.params.code);
      res.json(trip);
    } catch (err) { next(err); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createTripSchema.parse(req.body);
      const trip = await tripsService.create(data, req.user!.id);
      res.status(201).json(trip);
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateTripSchema.parse(req.body);
      const trip = await tripsService.update(Number(req.params.id), data);
      res.json(trip);
    } catch (err) { next(err); }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = tripStatusSchema.parse(req.body);
      const trip = await tripsService.updateStatus(Number(req.params.id), status);
      res.json(trip);
    } catch (err) { next(err); }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await tripsService.remove(Number(req.params.id));
      res.json({ message: 'Trip deleted' });
    } catch (err) { next(err); }
  },
};
