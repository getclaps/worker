export type JSONable = { toJSON: (k?: string) => JSONValue }
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray | JSONable;
export type JSONObject = { [k: string]: JSONValue };
export type JSONArray = JSONValue[];
