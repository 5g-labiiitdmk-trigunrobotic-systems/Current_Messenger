// FILE PURPOSE: The JS entry point for the local "pip-controller" Expo
// native module (see modules/pip-controller/android for the Kotlin
// implementation). Not imported directly anywhere in app/ — see src/lib/pipController.ts,
// which looks this module up by its registered name ("PipController" via
// requireOptionalNativeModule) rather than importing this file by path.
// This file exists so the module has a conventional JS entry point, matching
// every other Expo module's shape, in case anything in the build tooling
// expects one.
import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule('PipController');
