# GasHubKE — Production Marketplace

A production-oriented LPG marketplace for Kenya.

## Stack
- HTML5, CSS3, Bootstrap 5
- Vanilla JavaScript ES modules
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Optional Firebase Cloud Functions for privileged operations

## Features
- Public marketplace
- Search/filter by county, town, brand, cylinder size and price
- Customer cart and checkout
- Customer orders
- Supplier registration and dashboard
- Supplier product/listing management
- Supplier order management
- Wallet/commission overview
- Account settings
- Mobile responsive navigation
- Firestore security rules
- Firebase Hosting configuration
- No secrets hard-coded into the source

## Commission model
The platform commission is KES 49 per cylinder/order item as configured in `assets/js/config.js`.
Suppliers handle delivery themselves. The platform does not add a delivery fee.

## Before deployment
1. Create/configure your Firebase project.
2. Copy Firebase web configuration into `assets/js/firebase-config.js`.
3. Enable Authentication providers you want to use.
4. Create Firestore and Storage.
5. Deploy Firestore rules and indexes.
6. Replace placeholder contact details in `assets/js/config.js`.
7. Review payment integration before enabling real payments.
8. Run `firebase deploy`.

## Important
Never put Firebase Admin SDK credentials, M-Pesa Daraja consumer secrets, or other private credentials in frontend files.
Use Cloud Functions/server-side environment variables for privileged operations.
