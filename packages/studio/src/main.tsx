import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const el = document.getElementById('root');
if (el !== null) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
