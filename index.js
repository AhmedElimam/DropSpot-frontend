// The app's entry (package.json "main"). The background refresh task has to be DEFINED
// before anything renders: expo-task-manager runs it headless, with no screen and no root
// layout, so it cannot live in a route file. Then the router takes over as usual.
import './src/background/refreshTask';
import './src/background/driverLocation';
import 'expo-router/entry';
