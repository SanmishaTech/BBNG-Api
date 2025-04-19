module.exports = {
  //only superadmin section
  //users
  "users.read": ["super_admin"],
  "users.write": ["super_admin"],
  "users.delete": ["super_admin"],
  "users.export": ["super_admin"],
  //agencies
  "agencies.read": ["super_admin"],
  "agencies.write": ["super_admin"],
  "agencies.delete": ["super_admin"],
  //packages
  "packages.read": ["super_admin"],
  "packages.write": ["super_admin"],
  "packages.delete": ["super_admin"],
  "subscriptions.write": ["super_admin"],
  //zones
  "zones.read": ["super_admin", "admin"],
  "zones.write": ["super_admin"],
  "zones.delete": ["super_admin"],
  //superAdmin and admin sections
  //branches
  "branches.read": ["super_admin", "admin"],
  "branches.write": ["super_admin", "admin"],
  "branches.delete": ["super_admin", "admin"],
  //countries
  "countries.write": ["super_admin", "admin"],
  "countries.delete": ["super_admin", "admin"],
  "countries.read": ["super_admin", "admin"],
  //states
  "states.write": ["super_admin", "admin"],
  "states.delete": ["super_admin", "admin"],
  "states.read": ["super_admin", "admin"],
  //cities
  "cities.write": ["super_admin", "admin"],
  "cities.delete": ["super_admin", "admin"],
  "cities.read": ["super_admin", "admin"],
  //sectors
  "sectors.write": ["super_admin", "admin"],
  "sectors.delete": ["super_admin", "admin"],
  "sectors.read": ["super_admin", "admin"],
  //roles
  "roles.read": ["super_admin", "admin"],
  //staff
  "staff.read": ["admin"],
  "staff.write": ["admin"],
  "staff.delete": ["admin"],
};
