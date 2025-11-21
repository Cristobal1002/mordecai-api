import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { config } from './index.js';

let firebaseApp;

export const initializeFirebase = () => {
  try {
    if (!firebaseApp) {
      let serviceAccount;

      // Option 1: Use environment variables (recommended)
      if (config.firebase.useEnvVars) {
        serviceAccount = {
          type: config.firebase.type,
          project_id: config.firebase.projectId,
          private_key_id: config.firebase.privateKeyId,
          private_key: config.firebase.privateKey.replace(/\\n/g, '\n'),
          client_email: config.firebase.clientEmail,
          client_id: config.firebase.clientId,
          auth_uri: config.firebase.authUri,
          token_uri: config.firebase.tokenUri,
          auth_provider_x509_cert_url: config.firebase.authProviderX509CertUrl,
          client_x509_cert_url: config.firebase.clientX509CertUrl,
          universe_domain: config.firebase.universeDomain,
        };
      } else {
        // Option 2: Use JSON file (fallback)
        serviceAccount = JSON.parse(
          readFileSync(config.firebase.serviceAccountPath, 'utf8')
        );
      }

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId,
      });
    }
    return firebaseApp;
  } catch (error) {
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

export const getAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
};

export const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};
