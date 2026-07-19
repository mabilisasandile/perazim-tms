import { Response, NextFunction } from 'express';
import { bookingsService } from './bookings.service';
import { AuthRequest } from '../../middleware/authenticate';
import { createBookingSchema, updateBookingStatusSchema } from './bookings.schema';
import { auditService, getIp } from '../audit-trail/audit.service';

export const bookingsController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.query;
      const bookings = await bookingsService.findAll(customerId ? Number(customerId) : undefined);
      res.json(bookings);
    } catch (err) { next(err); }
  },

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const booking = await bookingsService.findById(Number(req.params.id));
      res.json(booking);
    } catch (err) { next(err); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createBookingSchema.parse(req.body);
      const booking = await bookingsService.create(data, req.user!.id);
      res.status(201).json(booking);
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId:   booking.id,
        newValue:   booking,
      });
    } catch (err) { next(err); }
  },

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const oldBooking = await bookingsService.findById(id);
      const { status } = updateBookingStatusSchema.parse(req.body);
      const booking = await bookingsService.updateStatus(id, status);
      res.json(booking);
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_STATUS_UPDATED',
        entityType: 'BOOKING',
        entityId:   id,
        oldValue:   { status: oldBooking.status },
        newValue:   { status },
      });
    } catch (err) { next(err); }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const oldBooking = await bookingsService.findById(id);
      const result = await bookingsService.remove(id);
      res.json(result);
      auditService.log({
        username:   req.user!.username,
        ipAddress:  getIp(req),
        actionType: 'BOOKING_DELETED',
        entityType: 'BOOKING',
        entityId:   id,
        oldValue:   oldBooking,
      });
    } catch (err) { next(err); }
  },
};
