// Not imported directly anywhere in app/ — see src/lib/pipController.ts,
// which looks this module up by its registered name ("PipController" via
// requireOptionalNativeModule) rather than importing this file by path.
// This file exists so the module has a conventional JS entry point, matching
// every other Expo module's shape, in case anything in the build tooling
// expects one.
import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule('PipController');
