// Console stylesheets, loaded with the console chunk: AdminApp.tsx imports this file first, so
// they keep the order the console's import graph originally gave them (#138, #41).
//
// Public visitors never download them. The few rules public pages also use are copied in
// src/styles/legacy-shared.css, which stays in the main stylesheet.
import './AdminLayout.css';
import './pages/OperationsCenter.css';
import './pages/QuoteRequestsView.css';
import './components/EditShipmentModal.css';
import './components/DeleteShipmentModal.css';
import './components/RecentlyDeletedModal.css';
import './pages/AllShipmentsView.css';
import './pages/CreateShipmentView.css';
import './pages/TrackingEventsView.css';
import './pages/DocumentCenterView.css';
import './pages/SettingsView.css';
import './pages/MessagesView.css';
import './components/ShipmentControlModal.css';
import './AdminLogin.css';
