import './styles/main.css';
import { App } from './app';
import { registerAllEffects } from './effects/registerEffects';

registerAllEffects();

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root missing');
new App(root);
