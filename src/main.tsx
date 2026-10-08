import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installCloudflareStaticFallback } from './lib/runtimeApi.ts';

installCloudflareStaticFallback();

createRoot(document.getElementById('root')!).render(<App />);
