import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Cache les éléments de chargement une fois l'app prête
const hideLoading = () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App onReady={hideLoading} />
  </React.StrictMode>
);
