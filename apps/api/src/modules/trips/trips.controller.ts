import { Response, NextFunction } from 'express';
import { tripsService } from './trips.service';
import { AuthRequest } from '../../middleware/authenticate';
import { createTripSchema, updateTripSchema, tripStatusSchema } from './trips.schema';
import { TripStatus } from '@prisma/client';
import { auditService, getIp } from '../audit-trail/audit.service';

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
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId:   (trip as any)?.id,
        newValue:   trip,
      });
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const oldTrip = await tripsService.findById(id);
      const data = updateTripSchema.parse(req.body);
      const trip = await tripsService.update(id, data);
      res.json(trip);
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_UPDATED',
        entityType: 'BOOKING',
        entityId:   id,
        oldValue:   oldTrip,
        newValue:   trip,
      });
    } catch (err) { next(err); }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const oldTrip = await tripsService.findById(id);
      const { status } = tripStatusSchema.parse(req.body);
      const trip = await tripsService.updateStatus(id, status);
      res.json(trip);
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_STATUS_UPDATED',
        entityType: 'BOOKING',
        entityId:   id,
        oldValue:   { status: oldTrip.status },
        newValue:   { status },
      });
    } catch (err) { next(err); }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const oldTrip = await tripsService.findById(id);
      await tripsService.remove(id);
      res.json({ message: 'Trip deleted' });
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_DELETED',
        entityType: 'BOOKING',
        entityId:   id,
        oldValue:   oldTrip,
      });
    } catch (err) { next(err); }
  },
};
