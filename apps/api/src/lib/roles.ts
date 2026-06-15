export const ROLES = {
  SUPER_ADMIN:            'Super Administrator',
  ADMIN:                  'Administrator',
  OPERATIONS_CONTROLLER:  'Operations Controller',
  WAREHOUSE_CONTROLLER:   'Warehouse Controller',
  DISPATCH_CONTROLLER:    'Dispatch Controller',
  ACCOUNTS:               'Accounts',
  DRIVER:                 'Driver',
  SECURITY_GATE:          'Security Gate Operator',
} as const;

export type RoleKey = keyof typeof ROLES;

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

const ALL_PERMS = {
  vehicleList: true, vehicleView: true, vehicleEdit: true, vehicleAdd: true,
  vehicleGroup: true, vehicleGroupAdd: true, vehicleGroupAction: true,
  driverList: true, driverEdit: true, driverAdd: true,
  tripList: true, tripEdit: true, tripAdd: true,
  customerList: true, customerEdit: true, customerAdd: true,
  fuelList: true, fuelEdit: true, fuelAdd: true,
  reminderList: true, reminderDelete: true, reminderAdd: true,
  incomeExpenseList: true, incomeExpenseEdit: true,
};

const NO_PERMS = Object.fromEntries(
  Object.keys(ALL_PERMS).map(k => [k, false])
) as typeof ALL_PERMS;

export const ROLE_PERMISSIONS: Record<RoleKey, typeof ALL_PERMS> = {
  SUPER_ADMIN: { ...ALL_PERMS },

  ADMIN: { ...ALL_PERMS },

  OPERATIONS_CONTROLLER: {
    ...NO_PERMS,
    vehicleList: true, vehicleView: true, vehicleEdit: true,
    driverList: true, driverEdit: true,
    tripList: true, tripEdit: true, tripAdd: true,
    customerList: true, customerEdit: true,
    fuelList: true, fuelAdd: true,
    reminderList: true, reminderAdd: true,
  },

  WAREHOUSE_CONTROLLER: {
    ...NO_PERMS,
    vehicleList: true, vehicleView: true,
    driverList: true,
    tripList: true,
    reminderList: true,
  },

  DISPATCH_CONTROLLER: {
    ...NO_PERMS,
    vehicleList: true, vehicleView: true,
    tripList: true, tripEdit: true, tripAdd: true,
    driverList: true,
    customerList: true, customerEdit: true, customerAdd: true,
    reminderList: true, reminderAdd: true,
  },

  ACCOUNTS: {
    ...NO_PERMS,
    vehicleList: true,
    tripList: true,
    customerList: true,
    incomeExpenseList: true, incomeExpenseEdit: true,
  },

  DRIVER: {
    ...NO_PERMS,
    tripList: true,
    vehicleList: true,
  },

  SECURITY_GATE: {
    ...NO_PERMS,
    vehicleList: true, vehicleView: true,
    driverList: true,
    tripList: true,
  },
};

/** Roles allowed to manage other users */
export const ADMIN_ROLES: RoleKey[] = ['SUPER_ADMIN', 'ADMIN'];

export function isValidRole(role: string): role is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLES, role);
}
