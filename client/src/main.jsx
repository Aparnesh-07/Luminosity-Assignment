import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import './styles/variables.css';
import './styles/animations.css';
import './styles/components.css';
import './styles/login.css';
import './styles/tracker.css';
import './styles/invoices.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
