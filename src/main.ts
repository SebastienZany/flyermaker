import './styles/main.css';
import { App } from './app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root missing');
new App(root);
