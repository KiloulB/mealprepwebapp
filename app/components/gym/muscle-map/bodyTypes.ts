export type BodyPathGroup =
  | { common: string | string[] }
  | { left: string | string[]; right: string | string[] }
  | { left: string | string[] }
  | { right: string | string[] };

export type BodyPart = {
  name: string;
  slug: string;
  color?: string;
  path: BodyPathGroup;
};
