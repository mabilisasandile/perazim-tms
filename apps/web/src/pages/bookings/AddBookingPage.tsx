import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import PlacesAutocompleteInput from '../../components/maps/PlacesAutocompleteInput';

interface SelectOption { id: number; name: string; }
interface VehicleOption { id: number; name: string; registrationNo: string; }

const legSchema = z.object({
  driverId: z.coerce.number().int().positive('Driver is required'),
  startLocation: z.string().min(1, 'Start location is required'),
  endLocation: z.string().min(1, 'End location is required'),
  scheduledAt: z.string().optional(),
});

const schema = z.object({
  customerId: z.coerce.number().int().positive('Customer is required'),
  customerVehicleMake: z.string().min(1, 'Customer vehicle make & model is required'),
  customerVehicleColour: z.string().min(1, 'Customer vehicle colour is required'),
  customerVehicleRegistration: z.string().min(1, 'Customer vehicle registration is required'),
  customerVehicleVin: z.string().optional(),
  customerVehicleStock: z.string().optional(),
  customerVehicleEngine: z.string().optional(),
  driverId: z.coerce.number().int().positive('Perazim driver is required'),
  vehicleId: z.coerce.number().int().positive('Perazim truck is required'),
  trailerId: z.preprocess(v => (!v || v === '' || Number(v) === 0) ? null : Number(v), z.number().int().positive().optional().nullable()),
  fromLocation: z.string().min(1, 'Pickup location is required'),
  toLocation: z.string().min(1, 'Drop off location is required'),
  amount: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1, 'Trip start date is required'),
  endDate: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  sendConfirmationEmail: z.boolean().optional(),
  hasLegs: z.boolean().optional(),
  legs: z.array(legSchema).optional(),
});
type FormData = z.infer<typeof schema>;

const PICTURE_FIELDS = Array.from({ length: 8 }, (_, i) => `picture${i + 1}`);

export default function AddBookingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pictures, setPictures] = useState<Record<string, File | null>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: customers = [] } = useQuery<SelectOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => r.data.map((c: any) => ({ id: c.id, name: c.name }))),
  });
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => r.data.filter((v: any) => v.isActive)),
  });
  const { data: drivers = [] } = useQuery<SelectOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => r.data.filter((d: any) => d.isActive)),
  });
  const { data: trailers = [] } = useQuery<SelectOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => r.data.filter((t: any) => t.isActive).map((t: any) => ({ id: t.id, name: t.registrationNo }))),
  });

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sendConfirmationEmail: true, hasLegs: false, legs: [] },
  });

  const { fields: legFields, append: appendLeg, remove: removeLeg } = useFieldArray({ control, name: 'legs' });

  const hasLegs = watch('hasLegs');
  const fromLocationValue = watch('fromLocation') ?? '';
  const toLocationValue = watch('toLocation') ?? '';
  const selectedCustomerId = watch('customerId');

  // Pull the selected customer's trip history so we can auto-fill their
  // vehicle details (make/model, colour, registration, VIN, stock, engine)
  // from their most recent booking.
  const { data: customerTrips } = useQuery<any[]>({
    queryKey: ['customer-trips', selectedCustomerId],
    queryFn: () => api.get(`/customers/${selectedCustomerId}/trips`).then(r => r.data),
    enabled: !!selectedCustomerId && Number(selectedCustomerId) > 0,
  });

  const [autofilledCustomerId, setAutofilledCustomerId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedCustomerId || !customerTrips) return;
    const id = Number(selectedCustomerId);
    if (autofilledCustomerId === id) return; // already auto-filled for this customer

    const lastTrip = customerTrips[0]; // trips are returned newest-first
    if (lastTrip) {
      setValue('customerVehicleMake', lastTrip.customerVehicleMake ?? '', { shouldValidate: true });
      setValue('customerVehicleColour', lastTrip.customerVehicleColour ?? '', { shouldValidate: true });
      setValue('customerVehicleRegistration', lastTrip.customerVehicleRegistration ?? '', { shouldValidate: true });
      setValue('customerVehicleVin', lastTrip.customerVehicleVin ?? '');
      setValue('customerVehicleStock', lastTrip.customerVehicleStock ?? '');
      setValue('customerVehicleEngine', lastTrip.customerVehicleEngine ?? '');
    }
    setAutofilledCustomerId(id);
  }, [selectedCustomerId, customerTrips, autofilledCustomerId, setValue]);

  const createMut = useMutation({
    mutationFn: async (d: FormData) => {
      const { hasLegs: _hasLegs, legs, ...rest } = d;
      const payload = {
        ...rest,
        trailerId: rest.trailerId || null,
        legs: _hasLegs ? legs : undefined,
      };
      const res = await api.post('/trips', payload);
      const tripId = res.data.id;

      const filesToUpload = Object.entries(pictures).filter(([, f]) => f);
      if (filesToUpload.length > 0) {
        const form = new FormData();
        filesToUpload.forEach(([field, file]) => form.append(field, file as File));
        await api.post(`/trips/${tripId}/pictures`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['trips'] });
      setSubmitError('');
      setSubmitted(true);
      reset();
      setPictures({});
    },
    onError: (e: any) => setSubmitError(e.response?.data?.error || 'Failed to create booking'),
  });

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-xl border p-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto text-green-600" size={40} />
        <h2 className="text-xl font-bold text-gray-900">Booking Created</h2>
        <p className="text-sm text-gray-500">The booking has been submitted successfully.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setSubmitted(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Add Another Booking</button>
          <Link to="/app/bookings" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg">View Bookings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Add Booking</h1>
        <span className="text-xs text-brand-600">
          <Link to="/app/bookings" className="hover:underline">Bookings</Link> / Add Booking
        </span>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm"><AlertCircle size={16} /><span>{submitError}</span></div>
      )}

      <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-6">
        {/* CUSTOMER DETAILS */}
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Customer Details</h2>
            {autofilledCustomerId === Number(selectedCustomerId) && customerTrips?.[0] && (
              <span className="text-xs text-gray-400 italic">Vehicle details auto-filled from customer's last booking — edit as needed</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name*</label>
              <select {...register('customerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle Make & Model*</label>
              <input {...register('customerVehicleMake')} placeholder="Customer Vehicle Make & Model" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.customerVehicleMake && <p className="text-red-500 text-xs mt-1">{errors.customerVehicleMake.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle Colour*</label>
              <input {...register('customerVehicleColour')} placeholder="Customer Vehicle Colour" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.customerVehicleColour && <p className="text-red-500 text-xs mt-1">{errors.customerVehicleColour.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle Registration*</label>
              <input {...register('customerVehicleRegistration')} placeholder="Customer Vehicle Registration" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.customerVehicleRegistration && <p className="text-red-500 text-xs mt-1">{errors.customerVehicleRegistration.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle VIN</label>
              <input {...register('customerVehicleVin')} placeholder="Customer Vehicle VIN number" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle Stock No.</label>
              <input {...register('customerVehicleStock')} placeholder="Customer Vehicle stock number" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Vehicle Engine No.</label>
              <input {...register('customerVehicleEngine')} placeholder="Customer Vehicle engine number" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </section>

        {/* TRANSPORTER DETAILS */}
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Transporter Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perazim Driver*</label>
              <select {...register('driverId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select Perazim Driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.driverId && <p className="text-red-500 text-xs mt-1">{errors.driverId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perazim Truck*</label>
              <select {...register('vehicleId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select Perazim Truck</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select>
              {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perazim Trailer</label>
              <select {...register('trailerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select Perazim Trailer</option>
                {trailers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* TRIP DETAILS */}
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Trip Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <PlacesAutocompleteInput
                value={fromLocationValue}
                onChange={val => setValue('fromLocation', val, { shouldValidate: true })}
                onPlaceSelect={name => setValue('fromLocation', name, { shouldValidate: true })}
                placeholder="Enter a location"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.fromLocation && <p className="text-red-500 text-xs mt-1">{errors.fromLocation.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drop Off Location</label>
              <PlacesAutocompleteInput
                value={toLocationValue}
                onChange={val => setValue('toLocation', val, { shouldValidate: true })}
                onPlaceSelect={name => setValue('toLocation', name, { shouldValidate: true })}
                placeholder="Enter a location"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.toLocation && <p className="text-red-500 text-xs mt-1">{errors.toLocation.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Amount (Excl. VAT)*</label>
              <input type="number" step="0.01" {...register('amount')} placeholder="Trip Amount" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Start Date</label>
              <input type="date" {...register('startDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip End Date</label>
              <input type="date" {...register('endDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Status</label>
              <select {...register('status')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Trip Status</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </section>

        {/* EMAIL CONFIRMATION */}
        <section className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Email Confirmation</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('sendConfirmationEmail')} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            Do you want to send Booking Confirmation Email to customer?
          </label>
        </section>

        {/* TRIP LEGS */}
        <section className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Trip Legs</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('hasLegs')} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            This trip has legs
          </label>

          {hasLegs && (
            <div className="space-y-3 pt-2">
              {legFields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border-t pt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Leg Driver</label>
                    <select {...register(`legs.${i}.driverId` as const)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                      <option value="">Select Driver</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {errors.legs?.[i]?.driverId && <p className="text-red-500 text-xs mt-1">{errors.legs[i]?.driverId?.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Location</label>
                    <input {...register(`legs.${i}.startLocation` as const)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Location</label>
                    <input {...register(`legs.${i}.endLocation` as const)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Scheduled Date</label>
                    <input type="date" {...register(`legs.${i}.scheduledAt` as const)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <button type="button" onClick={() => removeLeg(i)} className="flex items-center justify-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => appendLeg({ driverId: 0 as any, startLocation: '', endLocation: '', scheduledAt: '' })}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Plus size={14} /> Add Leg
              </button>
            </div>
          )}
        </section>

        {/* VEHICLE PICTURES UPLOAD */}
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Vehicle Pictures Upload</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {PICTURE_FIELDS.map((field, i) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Picture {i + 1}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPictures(p => ({ ...p, [field]: e.target.files?.[0] ?? null }))}
                  className="w-full text-sm border rounded-lg px-2 py-1.5 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-xs file:text-gray-600"
                />
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT */}
        <section className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Submit Your Booking</h2>
          <button type="submit" disabled={isSubmitting || createMut.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {createMut.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {createMut.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </section>
      </form>
    </div>
  );
}