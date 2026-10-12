/**
 * The popup host an open window carries (src/ui/dialog.tsx → DialogHost nested). Loaded on
 * first render, not at import, so a sheet or modal never pulls the dialog's stores and
 * portraits into everything that imports it — and a host that cannot load never breaks
 * the window it sits in.
 */
export function NestedDialogHost() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DialogHost } = require('./dialog') as typeof import('./dialog');
    return <DialogHost nested />;
  } catch {
    return null;
  }
}
