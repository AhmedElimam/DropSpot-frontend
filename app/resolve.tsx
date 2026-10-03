/**
 * `/resolve` — the root router under a name no route group shares. `/` is ambiguous from
 * inside a group (it also matches that group's index tab); this is not. Every in-app
 * «route me by role» goes here (src/utils/routes.ts). Cold start still lands on `/`.
 */
export { default } from './index';
