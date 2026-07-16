import { XMLParser } from 'fast-xml-parser';

/**
 * Shared XMLParser factory for all Moodle backup XML files.
 *
 * parseTagValue is disabled on purpose: Moodle text fields regularly contain
 * numeric-looking values (activity titles like "2024", answers like "0100")
 * that fast-xml-parser would otherwise coerce to numbers, breaking string
 * schemas and silently dropping leading zeros. All genuinely numeric fields
 * go through Number()/z.coerce.number() at their call sites instead.
 */
export function createXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    // Real Moodle backups contain megabytes of HTML with tens of thousands of
    // benign &amp;/&lt; entities (each expands 1:1, no amplification), which
    // trips the default maxTotalExpansions=1000 / maxExpandedLength=100KB.
    // Billion-laughs protection stays intact via the DOCTYPE-entity limits
    // (maxEntitySize, maxEntityCount, maxExpansionDepth defaults).
    processEntities: {
      enabled: true,
      maxTotalExpansions: Infinity,
      maxExpandedLength: Infinity,
    },
  });
}

/** Parse Moodle boolean fields that arrive as "true"/"false"/"1"/"0" strings. */
export function parseXmlBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}
