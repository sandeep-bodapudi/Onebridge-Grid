// Run by deploy/mongo/init.sh with mongosh as the root user. Idempotent.
/* global rs, db, process, sleep, print */

let status;
try {
  status = rs.status();
} catch (err) {
  status = null;
}

if (!status || status.ok !== 1) {
  print('Starting replica set rs0...');
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] });
}

// Wait until this node is primary before writing users.
for (let i = 0; i < 60; i++) {
  const hello = db.adminCommand({ hello: 1 });
  if (hello.isWritablePrimary) break;
  sleep(1000);
}

const appUser = process.env.MONGO_APP_USER;
const appPassword = process.env.MONGO_APP_PASSWORD;
const onebridge = db.getSiblingDB('onebridge');

if (onebridge.getUser(appUser)) {
  // Keep the password in step with .env (a changed MONGO_APP_PASSWORD takes effect on the next deploy).
  onebridge.updateUser(appUser, { pwd: appPassword });
  print(`App user "${appUser}" exists; password refreshed.`);
} else {
  onebridge.createUser({ user: appUser, pwd: appPassword, roles: [{ role: 'readWrite', db: 'onebridge' }] });
  print(`App user "${appUser}" created.`);
}
