/**
 * Register default column specs (side-effect import).
 * Keep this file small: only registrations.
 */
import { columnRegistry } from './registry.js';
import { makeProjectColumnSpecs } from './specs/projectColumns.js';

// Register Project-related columns
for (const spec of makeProjectColumnSpecs()) {
  if (spec?.fieldPrefix) columnRegistry.registerPrefix(spec.fieldPrefix, spec);
  else if (spec?.field) columnRegistry.register(spec.field, spec);
}


