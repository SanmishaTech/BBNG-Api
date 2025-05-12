module.exports = {
  //only superadmin section
  //users
  "users.read": ["super_admin"],
  "users.write": ["super_admin"],
  "users.delete": ["super_admin"],
  "users.export": ["super_admin"],
  "members.export": ["super_admin", "admin", "member", "user"],
  "transactions.export": ["super_admin", "admin", "member", "user"],
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
  //trainings
  "trainings.read": ["super_admin", "admin"],
  "trainings.write": ["super_admin", "admin"],
  "trainings.update": ["super_admin", "admin"],
  "trainings.delete": ["super_admin"],
  //categories
  "categories.read": ["super_admin", "admin"],
  "categories.write": ["super_admin", "admin"],
  "categories.update": ["super_admin", "admin"],
  "categories.delete": ["super_admin"],
  //messages
  "messages.read": ["super_admin", "admin"],
  "messages.write": ["super_admin", "admin"],
  "messages.update": ["super_admin", "admin"],
  "messages.delete": ["super_admin"],
  // requirements
  "requirements.read": ["super_admin", "admin", "member", "user"],
  "requirements.write": ["super_admin", "admin", "member", "user"],
  "requirements.delete": ["super_admin", "admin", "member", "user"],
  // one-to-ones
  "onetoones.read": ["super_admin", "admin", "member", "user"],
  "onetoones.write": ["super_admin", "admin", "member", "user"],
  "onetoones.delete": ["super_admin", "admin", "member", "user"],
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
