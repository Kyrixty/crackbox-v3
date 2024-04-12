export type FieldValueType = boolean | number | string | [];

export enum ConfigFieldType {
  BOOL = "BOOL",
  NUMBER = "NUMBER",
  STRING = "STRING",
  SELECT = "SELECT",
}

export type ConfigField = {
  name: string;
  type: ConfigFieldType;
  value: boolean | number | string | [];
}