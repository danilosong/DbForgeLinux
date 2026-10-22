export interface SqlSignature { name: string; parameters: string[]; description: string }
export interface ActiveSqlSignature { name: string; label: string; parameters: string[]; description: string; activeParameter: number; parameterRanges: Array<[number, number]> }

// This hand-authored catalog follows MySQL 8.4 native function families. Parameter labels
// describe argument roles in TuxSQL's own wording and deliberately avoid server documentation copy.
const nativeSignatureRows = `
ABS|number
ACOS|number
ADDDATE|date, interval
ADDTIME|time, time_to_add
AES_DECRYPT|ciphertext, key[, initialization_vector]
AES_ENCRYPT|plaintext, key[, initialization_vector[, key_identifier]]
ANY_VALUE|expression
ASCII|text
ASIN|number
ATAN|number
ATAN2|ordinate, abscissa
BENCHMARK|repeat_count, expression
BIN|number
BIN_TO_UUID|binary_uuid[, swap_time_parts]
BIT_AND|expression
BIT_COUNT|number
BIT_LENGTH|text
BIT_OR|expression
BIT_XOR|expression
CEIL|number
CEILING|number
CHAR|code[, code...[, USING charset]]
CHAR_LENGTH|text
CHARACTER_LENGTH|text
CHARSET|expression
COERCIBILITY|expression
COLLATION|text
COMPRESS|text
CONCAT|first_value, next_value[, value...]
CONCAT_WS|separator, first_value, next_value[, value...]
CONNECTION_ID|
CONV|number, source_base, target_base
CONVERT|expression, target_type
CONVERT_TZ|datetime, source_zone, target_zone
COS|number
COT|number
CRC32|text
CUME_DIST|
CURDATE|
CURRENT_DATE|
CURRENT_ROLE|
CURRENT_TIME|fractional_precision
CURRENT_TIMESTAMP|fractional_precision
CURRENT_USER|
CURTIME|
DATABASE|
DATE|datetime
DATE_ADD|date, interval
DATE_FORMAT|date, format_pattern
DATE_SUB|date, interval
DATEDIFF|first_date, second_date
DAY|date
DAYNAME|date
DAYOFMONTH|date
DAYOFWEEK|date
DAYOFYEAR|date
DEGREES|radians
DENSE_RANK|
ELT|index, first_value[, value...]
EXP|number
EXPORT_SET|bits, on_text, off_text[, separator[, bit_count]]
EXTRACT|unit FROM date
EXTRACTVALUE|xml, xpath
FIELD|search_value, first_value[, value...]
FIND_IN_SET|search_text, comma_list
FIRST_VALUE|expression
FLOOR|number
FORMAT|number, decimal_places[, locale]
FORMAT_BYTES|byte_count
FORMAT_PICO_TIME|picoseconds
FOUND_ROWS|
FROM_BASE64|encoded_text
FROM_DAYS|day_number
FROM_UNIXTIME|unix_seconds[, format_pattern]
GET_FORMAT|date_type, locale
GET_LOCK|lock_name, timeout_seconds
GREATEST|first_value, next_value[, value...]
GROUP_CONCAT|expression[, expression...]
GROUPING|expression[, expression...]
HEX|value
HOUR|time
ICU_VERSION|
INET_ATON|ip_address
INET_NTOA|numeric_address
INSERT|text, position, remove_length, replacement
INSTR|text, search_text
INTERVAL|value, first_bound[, bound...]
IS_FREE_LOCK|lock_name
IS_USED_LOCK|lock_name
IS_UUID|text
ISNULL|expression
JSON_ARRAY|value[, value...]
JSON_ARRAY_APPEND|document, path, value[, path, value...]
JSON_ARRAY_INSERT|document, path, value[, path, value...]
JSON_ARRAYAGG|expression
JSON_CONTAINS|document, candidate[, path]
JSON_CONTAINS_PATH|document, match_mode, path[, path...]
JSON_DEPTH|document
JSON_EXTRACT|document, path[, path...]
JSON_INSERT|document, path, value[, path, value...]
JSON_KEYS|document[, path]
JSON_LENGTH|document[, path]
JSON_MERGE|first_document, next_document[, document...]
JSON_MERGE_PATCH|first_document, next_document[, document...]
JSON_MERGE_PRESERVE|first_document, next_document[, document...]
JSON_OBJECT|key, value[, key, value...]
JSON_OBJECTAGG|key, value
JSON_OVERLAPS|first_document, second_document
JSON_PRETTY|document
JSON_QUOTE|text
JSON_REMOVE|document, path[, path...]
JSON_REPLACE|document, path, value[, path, value...]
JSON_SCHEMA_VALID|schema, document
JSON_SCHEMA_VALIDATION_REPORT|schema, document
JSON_SEARCH|document, match_mode, search_text[, escape_char[, path...]]
JSON_SET|document, path, value[, path, value...]
JSON_STORAGE_FREE|document
JSON_STORAGE_SIZE|document
JSON_TYPE|document
JSON_UNQUOTE|document
JSON_VALID|document
JSON_VALUE|document, path [RETURNING type] [ON EMPTY clause] [ON ERROR clause]
LAG|expression[, offset[, default_value]]
LAST_DAY|date
LAST_INSERT_ID|value
LAST_VALUE|expression
LEAD|expression[, offset[, default_value]]
LEAST|first_value, next_value[, value...]
LEFT|text, character_count
LENGTH|text
LN|number
LOAD_FILE|file_path
LOCATE|search_text, text[, start_position]
LOG|number[, base]
LOG10|number
LOG2|number
LOWER|text
LPAD|text, target_length, pad_text
LTRIM|text
MAKE_SET|bits, first_value[, value...]
MAKEDATE|year, day_of_year
MAKETIME|hour, minute, second
MASTER_POS_WAIT|source_log, source_position[, timeout_seconds[, channel]]
MATCH|column[, column...] AGAINST query
MAX|expression
MD5|text
MICROSECOND|time
MID|text, start_position[, length]
MIN|expression
MINUTE|time
MOD|dividend, divisor
MONTH|date
MONTHNAME|date
NAME_CONST|name, value
NOW|fractional_precision
NTH_VALUE|expression, row_number
NTILE|bucket_count
NULLIF|first_value, second_value
OCT|number
OCTET_LENGTH|text
ORD|text
PERCENT_RANK|
PERIOD_ADD|year_month, month_count
PERIOD_DIFF|first_period, second_period
PI|
POW|base, exponent
POWER|base, exponent
PS_CURRENT_THREAD_ID|
PS_THREAD_ID|processlist_id
QUARTER|date
QUOTE|text
RADIANS|degrees
RAND|seed
RANDOM_BYTES|byte_count
RANK|
REGEXP_INSTR|text, pattern[, start_position[, occurrence[, return_option[, match_type]]]]
REGEXP_LIKE|text, pattern[, match_type]
REGEXP_REPLACE|text, pattern, replacement[, start_position[, occurrence[, match_type]]]
REGEXP_SUBSTR|text, pattern[, start_position[, occurrence[, match_type]]]
RELEASE_ALL_LOCKS|
RELEASE_LOCK|lock_name
REPEAT|text, repeat_count
REPLACE|text, search_text, replacement
REVERSE|text
RIGHT|text, character_count
ROUND|number[, decimal_places]
ROW_COUNT|
ROW_NUMBER|
RPAD|text, target_length, pad_text
RTRIM|text
SCHEMA|
SEC_TO_TIME|seconds
SECOND|time
SHA|text
SHA1|text
SHA2|text, digest_bits
SIGN|number
SIN|number
SLEEP|seconds
SOUNDEX|text
SPACE|character_count
SQRT|number
ST_AREA|geometry[, unit]
ST_ASBINARY|geometry[, axis_order]
ST_ASGEOJSON|geometry[, maximum_decimal_digits[, options]]
ST_ASTEXT|geometry[, axis_order]
ST_BUFFER|geometry, distance[, strategy]
ST_BUFFER_STRATEGY|strategy, parameter
ST_CENTROID|geometry
ST_COLLECT|first_geometry, second_geometry
ST_CONTAINS|first_geometry, second_geometry
ST_CONVEXHULL|geometry
ST_CROSSES|first_geometry, second_geometry
ST_DIFFERENCE|first_geometry, second_geometry
ST_DIMENSION|geometry
ST_DISJOINT|first_geometry, second_geometry
ST_DISTANCE|first_geometry, second_geometry[, unit]
ST_DISTANCE_SPHERE|first_geometry, second_geometry[, radius]
ST_ENDPOINT|linestring
ST_ENVELOPE|geometry
ST_EQUALS|first_geometry, second_geometry
ST_EXTERIORRING|polygon
ST_FRECHETDISTANCE|first_geometry, second_geometry[, unit]
ST_GEOHASH|geometry, maximum_characters
ST_GEOMCOLLFROMTEXT|wkt[, srid]
ST_GEOMCOLLFROMWKB|wkb[, srid]
ST_GEOMETRYCOLLECTIONFROMTEXT|wkt[, srid]
ST_GEOMETRYCOLLECTIONFROMWKB|wkb[, srid]
ST_GEOMETRYN|geometry_collection, index
ST_GEOMETRYTYPE|geometry
ST_INTERIORRINGN|polygon, index
ST_INTERSECTION|first_geometry, second_geometry
ST_INTERSECTS|first_geometry, second_geometry
ST_ISCLOSED|geometry
ST_ISEMPTY|geometry
ST_ISSIMPLE|geometry
ST_ISVALID|geometry
ST_LATFROMGEOHASH|geohash
ST_LATITUDE|point
ST_LENGTH|geometry[, unit]
ST_LINEFROMTEXT|wkt[, srid]
ST_LINEFROMWKB|wkb[, srid]
ST_LONGFROMGEOHASH|geohash
ST_LONGITUDE|point
ST_MAKEENVELOPE|first_point, second_point
ST_NUMGEOMETRIES|geometry_collection
ST_NUMINTERIORRING|polygon
ST_NUMPOINTS|linestring
ST_OVERLAPS|first_geometry, second_geometry
ST_POINTFROMGEOHASH|geohash, srid
ST_POINTFROMTEXT|wkt[, srid]
ST_POINTFROMWKB|wkb[, srid]
ST_POINTN|linestring, index
ST_POLYFROMTEXT|wkt[, srid]
ST_POLYFROMWKB|wkb[, srid]
ST_POLYGONFROMTEXT|wkt[, srid]
ST_POLYGONFROMWKB|wkb[, srid]
ST_SIMPLIFY|geometry, tolerance
ST_SRID|geometry
ST_STARTPOINT|linestring
ST_SYMDIFFERENCE|first_geometry, second_geometry
ST_TOUCHES|first_geometry, second_geometry
ST_TRANSFORM|geometry, target_srid
ST_UNION|first_geometry, second_geometry
ST_VALIDATE|geometry
ST_WITHIN|first_geometry, second_geometry
ST_X|point
ST_Y|point
STR_TO_DATE|text, format_pattern
STRCMP|first_text, second_text
SUBDATE|date, interval
SUBSTR|text, start_position[, length]
SUBSTRING|text, start_position[, length]
SUBSTRING_INDEX|text, delimiter, occurrence_count
SUM|expression
SYSDATE|fractional_precision
SYSTEM_USER|
TAN|number
TIME|datetime
TIME_FORMAT|time, format_pattern
TIME_TO_SEC|time
TIMEDIFF|first_time, second_time
TIMESTAMP|date[, time]
TIMESTAMPADD|unit, interval, date
TIMESTAMPDIFF|unit, first_date, second_date
TO_BASE64|text
TO_DAYS|date
TO_SECONDS|date
TRIM|text
TRUNCATE|number, decimal_places
UCASE|text
UNCOMPRESS|compressed_text
UNCOMPRESSED_LENGTH|compressed_text
UNHEX|hex_text
UNIX_TIMESTAMP|date
UPDATEXML|xml, xpath, replacement
UPPER|text
USER|
UTC_DATE|
UTC_TIME|fractional_precision
UTC_TIMESTAMP|fractional_precision
UUID|
UUID_SHORT|
UUID_TO_BIN|text_uuid[, swap_time_parts]
VALIDATE_PASSWORD_STRENGTH|password
VERSION|
WAIT_FOR_EXECUTED_GTID_SET|gtid_set[, timeout_seconds[, channel]]
WEEK|date[, week_mode]
WEEKDAY|date
WEEKOFYEAR|date
WEIGHT_STRING|text[, type_parameters]
YEAR|date
YEARWEEK|date[, week_mode]
LCASE|text
POSITION|search_text IN text
SESSION_USER|
STD|expression
STDDEV|expression
STDDEV_POP|expression
STDDEV_SAMP|expression
VARIANCE|expression
VAR_POP|expression
VAR_SAMP|expression
COALESCE|first_value, next_value[, value...]
IF|condition, value_if_true, value_if_false
IFNULL|value, replacement
ASYNCHRONOUS_CONNECTION_FAILOVER_ADD_MANAGED|channel, managed_name, managed_type, managed_port
ASYNCHRONOUS_CONNECTION_FAILOVER_ADD_SOURCE|channel, host, port, network_namespace
ASYNCHRONOUS_CONNECTION_FAILOVER_DELETE_MANAGED|channel, managed_name, managed_type, managed_port
ASYNCHRONOUS_CONNECTION_FAILOVER_DELETE_SOURCE|channel, host, port, network_namespace
ASYNCHRONOUS_CONNECTION_FAILOVER_RESET|channel
CAST|expression AS target_type
CURRENT_ROLE|
GEOMCOLLECTION|geometry[, geometry...]
GEOMETRYCOLLECTION|geometry[, geometry...]
LINESTRING|point[, point...]
MULTILINESTRING|linestring[, linestring...]
MULTIPOINT|point[, point...]
MULTIPOLYGON|polygon[, polygon...]
POINT|x_coordinate, y_coordinate[, srid]
POLYGON|linestring[, linestring...]
ROLES_GRAPHML|
ST_ASWKB|geometry[, axis_order]
ST_ASWKT|geometry[, axis_order]
ST_GEOMFROMGEOJSON|json[, options[, srid]]
ST_GEOMFROMTEXT|wkt[, srid[, axis_order]]
ST_GEOMFROMWKB|wkb[, srid[, axis_order]]
ST_MULTILINESTRINGFROMTEXT|wkt[, srid]
ST_MULTILINESTRINGFROMWKB|wkb[, srid]
ST_MULTIPOINTFROMTEXT|wkt[, srid]
ST_MULTIPOINTFROMWKB|wkb[, srid]
ST_MULTIPOLYGONFROMTEXT|wkt[, srid]
ST_MULTIPOLYGONFROMWKB|wkb[, srid]
ST_MLINEFROMTEXT|wkt[, srid]
ST_MLINEFROMWKB|wkb[, srid]
ST_MPOINTFROMTEXT|wkt[, srid]
ST_MPOINTFROMWKB|wkb[, srid]
ST_MPOLYFROMTEXT|wkt[, srid]
ST_MPOLYFROMWKB|wkb[, srid]
ST_SRID|geometry[, srid]
MBRCONTAINS|first_geometry, second_geometry
MBRCOVEREDBY|first_geometry, second_geometry
MBRCOVERS|first_geometry, second_geometry
MBRDISJOINT|first_geometry, second_geometry
MBREQUALS|first_geometry, second_geometry
MBRINTERSECTS|first_geometry, second_geometry
MBROVERLAPS|first_geometry, second_geometry
MBRTOUCHES|first_geometry, second_geometry
MBRWITHIN|first_geometry, second_geometry
`
const nativeFunctionDescriptions: Record<string, string> = {
  AVG: 'Calculates the mean of the non-null values in a group.', BIT_AND: 'Combines grouped values with a bitwise AND operation.', BIT_OR: 'Combines grouped values with a bitwise OR operation.', BIT_XOR: 'Combines grouped values with a bitwise XOR operation.',
  COUNT: 'Counts rows or non-null values in a group.', MAX: 'Finds the greatest non-null value in a group.', MIN: 'Finds the least non-null value in a group.', SUM: 'Adds non-null values in a group.', STD: 'Calculates the population standard deviation of grouped values.', STDDEV: 'Calculates the population standard deviation of grouped values.', STDDEV_POP: 'Calculates the population standard deviation of grouped values.', STDDEV_SAMP: 'Calculates the sample standard deviation of grouped values.', VARIANCE: 'Calculates the population variance of grouped values.', VAR_POP: 'Calculates the population variance of grouped values.', VAR_SAMP: 'Calculates the sample variance of grouped values.',
  COALESCE: 'Returns the first non-null value from the arguments.', IF: 'Chooses a result based on whether a condition is true.', IFNULL: 'Uses a fallback value when the first argument is null.', NULLIF: 'Returns null when the two arguments are equal.', GREATEST: 'Finds the greatest value among the arguments.', LEAST: 'Finds the least value among the arguments.',
  CONCAT: 'Joins text values in the order provided.', CONCAT_WS: 'Joins text values with the supplied separator.', SUBSTRING: 'Returns a portion of text from the requested position.', SUBSTR: 'Returns a portion of text from the requested position.', MID: 'Returns a portion of text from the requested position.', LEFT: 'Returns the requested number of characters from the start of text.', RIGHT: 'Returns the requested number of characters from the end of text.', LENGTH: 'Returns the byte length of a string.', CHAR_LENGTH: 'Returns the character count of a string.', CHARACTER_LENGTH: 'Returns the character count of a string.', REPLACE: 'Replaces matching text within a string.', LOWER: 'Converts text to lowercase.', UPPER: 'Converts text to uppercase.', TRIM: 'Removes surrounding spaces or the requested characters.', LOCATE: 'Finds the first position of one string within another.', INSTR: 'Finds the first position of one string within another.', REGEXP_LIKE: 'Checks whether text matches a regular expression.', REGEXP_REPLACE: 'Replaces text that matches a regular expression.', REGEXP_SUBSTR: 'Returns the portion of text matching a regular expression.', REGEXP_INSTR: 'Finds the position of a regular-expression match.',
  DATE_FORMAT: 'Formats a date or time value with the supplied pattern.', STR_TO_DATE: 'Parses text into a date or time value using a pattern.', DATE_ADD: 'Adds an interval to a date or time value.', DATE_SUB: 'Subtracts an interval from a date or time value.', ADDDATE: 'Adds an interval to a date value.', SUBDATE: 'Subtracts an interval from a date value.', DATEDIFF: 'Returns the number of days between two dates.', TIMESTAMPDIFF: 'Returns the difference between two date or time values in a chosen unit.', TIMESTAMPADD: 'Adds a chosen number of units to a date or time value.', CONVERT_TZ: 'Converts a date or time value between time zones.', NOW: 'Returns the current date and time.', SYSDATE: 'Returns the current system date and time.', CURDATE: 'Returns the current date.', CURRENT_DATE: 'Returns the current date.', CURTIME: 'Returns the current time.', CURRENT_TIME: 'Returns the current time.', CURRENT_TIMESTAMP: 'Returns the current date and time.', UTC_DATE: 'Returns the current UTC date.', UTC_TIME: 'Returns the current UTC time.', UTC_TIMESTAMP: 'Returns the current UTC date and time.',
  JSON_ARRAY: 'Builds a JSON array from the supplied values.', JSON_OBJECT: 'Builds a JSON object from key and value pairs.', JSON_ARRAYAGG: 'Collects grouped values into a JSON array.', JSON_OBJECTAGG: 'Collects grouped key and value pairs into a JSON object.', JSON_EXTRACT: 'Reads values at the supplied paths in a JSON document.', JSON_SET: 'Adds or replaces values at paths in a JSON document.', JSON_INSERT: 'Adds values at paths that are missing from a JSON document.', JSON_REPLACE: 'Replaces values at existing paths in a JSON document.', JSON_REMOVE: 'Removes values at paths in a JSON document.', JSON_CONTAINS: 'Checks whether a JSON document contains a candidate value.', JSON_CONTAINS_PATH: 'Checks whether a JSON document has one or more paths.', JSON_VALUE: 'Reads a scalar value from a JSON document.', JSON_VALID: 'Checks whether text contains valid JSON.', JSON_TYPE: 'Returns the type of a JSON value.', JSON_LENGTH: 'Returns the number of members in a JSON value.', JSON_DEPTH: 'Returns the nesting depth of a JSON value.', JSON_PRETTY: 'Formats a JSON document for easier reading.', JSON_QUOTE: 'Escapes text and wraps it as a JSON string.',
  ABS: 'Returns the magnitude of a number.', ROUND: 'Rounds a number to a chosen number of decimal places.', TRUNCATE: 'Cuts off a number after the chosen decimal place.', CEIL: 'Rounds a number upward to the next integer.', CEILING: 'Rounds a number upward to the next integer.', FLOOR: 'Rounds a number downward to the previous integer.', MOD: 'Returns the remainder after division.', POWER: 'Raises a number to a chosen exponent.', POW: 'Raises a number to a chosen exponent.', SQRT: 'Returns the square root of a number.', RAND: 'Generates a pseudo-random number.', CRC32: 'Calculates a 32-bit checksum for text.', MD5: 'Calculates an MD5 digest for text.', SHA: 'Calculates a SHA-1 digest for text.', SHA1: 'Calculates a SHA-1 digest for text.', SHA2: 'Calculates a SHA-2 digest with the requested bit length.', AES_ENCRYPT: 'Encrypts text with AES using the supplied key.', AES_DECRYPT: 'Decrypts AES data using the supplied key.', RANDOM_BYTES: 'Generates a byte string with random contents.',
  CONNECTION_ID: 'Returns the identifier of the current connection.', DATABASE: 'Returns the name of the current database.', SCHEMA: 'Returns the name of the current database.', CURRENT_USER: 'Returns the authenticated account for this session.', USER: 'Returns the client account and host for this session.', SYSTEM_USER: 'Returns the client account and host for this session.', SESSION_USER: 'Returns the client account and host for this session.', VERSION: 'Returns the server version string.', UUID: 'Generates a UUID value.', UUID_SHORT: 'Generates a compact integer identifier.', LAST_INSERT_ID: 'Returns the most recent generated auto-increment value.', FOUND_ROWS: 'Returns the row count from the preceding limited query.', ROW_COUNT: 'Returns the affected row count from the preceding statement.',
  ST_DISTANCE: 'Measures the distance between two geometries.', ST_DISTANCE_SPHERE: 'Measures spherical distance between point geometries.', ST_AREA: 'Calculates the area of a geometry.', ST_LENGTH: 'Calculates the length of a geometry.', ST_CONTAINS: 'Checks whether one geometry contains another.', ST_WITHIN: 'Checks whether one geometry lies within another.', ST_INTERSECTS: 'Checks whether two geometries intersect.', ST_EQUALS: 'Checks whether two geometries represent the same shape.', ST_ASTEXT: 'Converts a geometry to its text representation.', ST_ASWKT: 'Converts a geometry to its text representation.', ST_ASBINARY: 'Converts a geometry to its binary representation.', ST_ASWKB: 'Converts a geometry to its binary representation.', ST_ASGEOJSON: 'Converts a geometry to GeoJSON.', ST_GEOMFROMTEXT: 'Creates a geometry from its text representation.', ST_GEOMFROMWKB: 'Creates a geometry from its binary representation.', ST_GEOMFROMGEOJSON: 'Creates a geometry from GeoJSON.', ST_BUFFER: 'Builds a region around a geometry at the requested distance.', ST_CENTROID: 'Returns the center point of a geometry.', ST_ENVELOPE: 'Returns the smallest bounding rectangle around a geometry.', ST_SRID: 'Returns or changes the spatial reference identifier of a geometry.'
}

function describeNativeFunction(name: string): string {
  if (name.startsWith('JSON_')) return 'Reads or transforms JSON values using the supplied paths and arguments.'
  if (name.startsWith('ST_') || name.startsWith('MBR')) return 'Evaluates a spatial property or relation for geometry values.'
  if (name.startsWith('AES_') || name.startsWith('SHA') || name === 'MD5' || name === 'CRC32') return 'Calculates a cryptographic digest or transforms protected data.'
  if (/^(DAY|WEEK|MONTH|YEAR|HOUR|MINUTE|SECOND|QUARTER|MICROSECOND)/.test(name)) return 'Returns a date or time part derived from the supplied value.'
  if (/^(ASIN|ACOS|ATAN|SIN|COS|TAN|COT|EXP|LOG|LN|SQRT|POW|POWER|ABS|SIGN|CEIL|FLOOR|ROUND|TRUNCATE|DEGREES|RADIANS)/.test(name)) return 'Calculates a mathematical result from the supplied numeric arguments.'
  if (/^(CURRENT_|UTC_|CUR)/.test(name)) return 'Returns the current date or time value for the session.'
  if (/^(BIT_|VAR_|STD)/.test(name)) return 'Calculates a bitwise or statistical result across grouped values.'
  if (/^(CHAR|CONCAT|ELT|FIELD|FIND|FORMAT|HEX|INSERT|INSTR|LEFT|LENGTH|LOCATE|LOWER|LPAD|LTRIM|MAKE_SET|MID|OCT|ORD|POSITION|QUOTE|REGEXP|REPEAT|REPLACE|REVERSE|RIGHT|RPAD|RTRIM|SOUNDEX|SPACE|STRCMP|SUBSTR|SUBSTRING|TO_BASE64|TRIM|UPPER|UNHEX|WEIGHT)/.test(name)) return 'Searches, formats, converts, or combines text values.'
  if (/^(IS_|ISNULL|COERCIBILITY|CHARSET|COLLATION|CONNECTION|DATABASE|SCHEMA|USER|VERSION|UUID|PS_|ROW_|FOUND_|LAST_INSERT)/.test(name)) return 'Returns information about the current connection or server state.'
  return 'Evaluates the supplied arguments and returns a MySQL value.'
}

export const mysql84NativeSignatures: SqlSignature[] = nativeSignatureRows.trim().split('\n').map((line) => {
  const [name, argumentList = ''] = line.split('|')
  const parameters = argumentList.replaceAll('[', '').replaceAll(']', '').split(',').map((parameter) => parameter.trim()).filter(Boolean)
  const normalizedName = name!.trim()
  return { name: normalizedName, parameters, description: nativeFunctionDescriptions[normalizedName] ?? describeNativeFunction(normalizedName) }
})

const signatures: SqlSignature[] = [
  ...mysql84NativeSignatures,
]
const byName = new Map(signatures.map((signature) => [signature.name, signature]))

function isEscaped(source: string, index: number): boolean {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) slashes++
  return slashes % 2 === 1
}

function activeCall(source: string): { name: string; start: number; parameter: number } | undefined {
  const stack: Array<{ index: number; commas: number }> = []
  let quote = ''
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    const next = source[index + 1] ?? ''
    if (lineComment) { if (char === '\n') lineComment = false; continue }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; index++ }; continue }
    if (quote) { if (char === quote && !isEscaped(source, index)) { if (next === quote) index++; else quote = '' }; continue }
    if ((char === '-' && next === '-' && (index + 2 >= source.length || /\s/.test(source[index + 2]!))) || char === '#') { lineComment = true; if (char === '-') index++; continue }
    if (char === '/' && next === '*') { blockComment = true; index++; continue }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '(') { stack.push({ index, commas: 0 }); continue }
    if (char === ')') { stack.pop(); continue }
    if (char === ',' && stack.length) stack[stack.length - 1]!.commas++
  }
  const call = stack.at(-1)
  if (!call) return undefined
  const start = call.index
  const before = source.slice(0, start).trimEnd()
  const match = /([A-Za-z_][\w$]*)$/.exec(before)
  if (!match) return undefined
  return { name: match[1]!.toUpperCase(), start, parameter: call.commas }
}

export function getActiveSqlSignature(source: string, offset: number, routines: Array<{ name: string; kind: 'procedure' | 'function'; parameters?: string[] }> = [], translate: (message: string) => string = (message) => message): ActiveSqlSignature | undefined {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return undefined
  const call = activeCall(source.slice(0, offset))
  const routine = call && routines.find((item) => item.name.toUpperCase() === call.name)
  const signature = call && byName.get(call.name)
  if (!signature && !routine) return undefined
  const parameters = routine ? (routine.parameters ?? []) : signature!.parameters
  if (!parameters.length && routine) return undefined
  const displayName = routine?.name ?? signature!.name
  const rendered = parameters.map((parameter, index) => index < parameters.length - 1 ? `${parameter}, ` : parameter)
  let position = displayName.length + 1
  const parameterRanges = rendered.map((parameter, index) => {
    const end = position + parameter.length - (index < rendered.length - 1 ? 2 : 0)
    const range: [number, number] = [position, end]
    position += parameter.length
    return range
  })
  return {
    name: displayName,
    label: `${displayName}(${rendered.join('')})`,
    parameters,
    description: routine ? '' : translate(signature!.description),
    activeParameter: parameters.length ? Math.min(call.parameter, parameters.length - 1) : 0,
    parameterRanges
  }
}
